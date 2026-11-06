import "server-only";
import { subDays } from "date-fns";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import type { ClienteResumen } from "@/features/clientes/schemas";
import type {
  DatosPanel,
  ItemPanel,
  SaldoVenta,
  TipoMetodo,
  TipoServicio,
} from "../types";

type Supabase = Awaited<ReturnType<typeof crearClienteServidor>>;

export function hoyEnBogota(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
  }).format(new Date());
}

/** Catálogo del panel: locales, servicios, profesionales, métodos activos, ajustes y los más vendidos. */
async function catalogo(supabase: Supabase) {
  const desde = subDays(new Date(), 30).toISOString();
  const [
    locales,
    servicios,
    productos,
    profesionales,
    metodos,
    ajustes,
    vendidos,
    giftCards,
    planes,
  ] = await Promise.all([
    supabase
      .from("locales")
      .select("id, nombre")
      .eq("activo", true)
      .order("created_at"),
    supabase
      .from("servicios")
      .select(
        "id, nombre, precio, duracion_min, tipo, sesiones, incluye, categorias(nombre)",
      )
      .eq("activo", true)
      .order("orden")
      .order("nombre"),
    supabase
      .from("productos")
      .select("id, nombre, precio, existencias, categoria")
      .eq("activo", true)
      .order("nombre")
      .limit(300),
    supabase
      .from("profesionales")
      .select("id, nombre, color")
      .eq("activo", true)
      .order("orden"),
    supabase
      .from("metodos_pago")
      .select("id, nombre, tipo")
      .eq("activo", true)
      .order("orden"),
    supabase.from("ajustes").select("caja_cliente_obligatorio").maybeSingle(),
    supabase
      .from("venta_items")
      .select("servicio_id, ventas!inner(created_at)")
      .not("servicio_id", "is", null)
      .gte("ventas.created_at", desde)
      .limit(500),
    supabase
      .from("gift_card_modelos")
      .select("id, nombre, monto, precio, vigencia_dias")
      .eq("activo", true)
      .order("monto"),
    supabase
      .from("planes")
      .select("id, nombre, precio, vigencia_dias, sesiones")
      .eq("activo", true)
      .order("nombre"),
  ]);
  const cuenta = new Map<string, number>();
  for (const v of vendidos.data ?? [])
    if (v.servicio_id)
      cuenta.set(v.servicio_id, (cuenta.get(v.servicio_id) ?? 0) + 1);
  return {
    locales: locales.data ?? [],
    servicios: (servicios.data ?? []).map((s) => ({
      id: s.id,
      nombre: s.nombre,
      precio: s.precio,
      duracionMin: s.duracion_min,
      categoria: s.categorias?.nombre ?? null,
      tipo: s.tipo as TipoServicio,
      sesiones: s.tipo === "paquete" ? s.incluye.length : s.sesiones,
    })),
    giftCards: (giftCards.data ?? []).map((g) => ({
      id: g.id,
      nombre: g.nombre,
      monto: g.monto,
      precio: g.precio,
      vigenciaDias: g.vigencia_dias,
    })),
    planes: (planes.data ?? []).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      precio: p.precio,
      vigenciaDias: p.vigencia_dias,
      sesiones: p.sesiones,
    })),
    productos: productos.data ?? [],
    profesionales: (profesionales.data ?? []).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      color: p.color ?? "#0E7490",
    })),
    metodos: (metodos.data ?? []).map((m) => ({
      id: m.id,
      nombre: m.nombre,
      tipo: m.tipo as TipoMetodo,
    })),
    clienteObligatorio: ajustes.data?.caja_cliente_obligatorio ?? false,
    recientes: [...cuenta.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id]) => id),
  };
}

/** Las citas que se cobran como ítems; las ya cobradas o canceladas quedan como aviso. */
async function citasComoItems(supabase: Supabase, ids: string[]) {
  if (!ids.length)
    return { items: [], avisos: [], clienteId: null, localId: null };
  const [{ data: citas }, { data: cobradas }] = await Promise.all([
    supabase
      .from("citas")
      .select(
        "id, cliente_id, local_id, servicio_id, profesional_id, fecha, hora_inicio, precio, estado, bono_id, servicios(nombre)",
      )
      .in("id", ids)
      .order("fecha")
      .order("hora_inicio"),
    supabase
      .from("venta_items")
      .select("cita_id, ventas(numero)")
      .in("cita_id", ids)
      .eq("vigente", true),
  ]);
  const numeroDe = new Map(
    (cobradas ?? []).map((c) => [c.cita_id, c.ventas?.numero ?? ""]),
  );
  const items: ItemPanel[] = [];
  const avisos: string[] = [];
  for (const c of citas ?? []) {
    const nombre = c.servicios?.nombre ?? "Servicio";
    if (numeroDe.has(c.id))
      avisos.push(
        `${nombre}: esta cita ya se cobró (venta ${numeroDe.get(c.id)})`,
      );
    else if (c.estado === "cancelado")
      avisos.push(`${nombre}: una cita cancelada no se cobra`);
    else
      items.push({
        clave: c.id,
        servicioId: c.servicio_id,
        productoId: null,
        planId: null,
        giftCardModeloId: null,
        citaId: c.id,
        profesionalId: c.profesional_id,
        descripcion: c.bono_id ? `${nombre} · con plan` : nombre,
        cantidad: 1,
        precioUnitario: c.precio,
        fecha: c.fecha,
        hora: c.hora_inicio.slice(0, 5),
      });
  }
  if (!citas?.length) avisos.push("La cita ya no existe");
  return {
    items,
    avisos,
    clienteId: citas?.[0]?.cliente_id ?? null,
    localId: citas?.[0]?.local_id ?? null,
  };
}

async function clienteResumen(
  supabase: Supabase,
  id: string | null,
): Promise<ClienteResumen | null> {
  if (!id) return null;
  const { data } = await supabase
    .from("clientes")
    .select("id, nombre, apellido, documento, correo, telefono, created_at")
    .eq("id", id)
    .maybeSingle();
  return data
    ? {
        id: data.id,
        nombre: data.nombre,
        apellido: data.apellido,
        documento: data.documento,
        correo: data.correo,
        telefono: data.telefono,
        creado: data.created_at,
      }
    : null;
}

async function ventaConSaldo(supabase: Supabase, id: string) {
  const { data } = await supabase
    .from("ventas")
    .select(
      "id, numero, total, pagado, estado, cliente_id, local_id, venta_items(descripcion)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return { error: "La venta ya no existe" } as const;
  if (data.estado === "anulada")
    return { error: "Esta venta está anulada" } as const;
  if (data.estado === "pagada")
    return { error: "Esta venta ya está pagada" } as const;
  const saldo: SaldoVenta = {
    id: data.id,
    numero: data.numero ?? "",
    total: data.total,
    pagado: data.pagado,
    detalle: data.venta_items.map((i) => i.descripcion).join(", "),
  };
  return { saldo, clienteId: data.cliente_id, localId: data.local_id } as const;
}

export interface PedidoValido {
  citaIds: string[];
  clienteId: string | null;
  ventaId: string | null;
}

/** Todo lo que el panel muestra al abrirse, según lo que se va a cobrar. */
export async function datosPanel(
  p: PedidoValido,
): Promise<{ ok: true; datos: DatosPanel } | { ok: false; error: string }> {
  const supabase = await crearClienteServidor();
  const venta = p.ventaId ? await ventaConSaldo(supabase, p.ventaId) : null;
  if (venta && "error" in venta)
    return { ok: false, error: venta.error ?? "La venta ya no existe" };
  const [base, citas] = await Promise.all([
    catalogo(supabase),
    citasComoItems(supabase, p.citaIds),
  ]);
  const cliente = await clienteResumen(
    supabase,
    venta?.clienteId ?? p.clienteId ?? citas.clienteId,
  );
  const localId = venta?.localId ?? citas.localId ?? base.locales[0]?.id;
  if (!localId) return { ok: false, error: "Crea un local antes de vender" };
  return {
    ok: true,
    datos: {
      ...base,
      localId,
      cliente,
      items: citas.items,
      avisos: citas.avisos,
      saldo: venta?.saldo ?? null,
      hoy: hoyEnBogota(),
    },
  };
}
