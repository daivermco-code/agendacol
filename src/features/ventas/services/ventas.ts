import "server-only";
import { format, startOfMonth, parseISO } from "date-fns";
import { z } from "zod";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import type { Json } from "@/types/database";
import type { PropinaCelular, VentaCelular } from "../lib/lista-celular";
import { esFecha } from "../lib/periodo-celular";
import type { DetalleVenta, EstadoVenta, TipoMetodo } from "../types";
import { hoyEnBogota } from "./panel";

/** Una fecha que existe en el calendario; lo demás («2026-02-30», «2026-13-01») cae al período por defecto. */
const fecha = z.string().refine(esFecha).catch("");
const uuidOVacio = z.string().uuid().or(z.literal("")).catch("");
const pagina = z.coerce.number().int().min(1).catch(1);
const porPagina = z.coerce
  .number()
  .refine((n) => [25, 50, 100].includes(n))
  .catch(25);

/**
 * Sin período en la dirección: el mes en curso hasta hoy. Con solo `hasta`, desde el primero de ese mes; un rango
 * al revés se voltea.
 */
export function conPeriodo<T extends { desde: string; hasta: string }>(
  f: T,
): T {
  const hasta = f.hasta || hoyEnBogota();
  const desde = f.desde || format(startOfMonth(parseISO(hasta)), "yyyy-MM-dd");
  return desde <= hasta
    ? { ...f, desde, hasta }
    : { ...f, desde: hasta, hasta: desde };
}

export const esquemaFiltrosVentas = z.object({
  desde: fecha,
  hasta: fecha,
  estado: z.enum(["", "pagada", "parcial", "anulada"]).catch(""),
  metodo: uuidOVacio,
  q: z.string().trim().max(60).catch(""),
  pagina,
  por: porPagina,
});
export type FiltrosVentas = z.output<typeof esquemaFiltrosVentas>;

export interface Tarjeta {
  n: number;
  monto: number;
}

export interface FilaVenta {
  id: string;
  numero: string;
  fecha: string;
  total: number;
  pagado: number;
  estado: EstadoVenta;
  clienteId: string | null;
  cliente: string;
  metodos: string;
}

const p = (o: Record<string, unknown>) => o as Json;

export async function listarVentas(f: FiltrosVentas) {
  const supabase = await crearClienteServidor();
  const filtros = {
    desde: f.desde,
    hasta: f.hasta,
    metodoId: f.metodo,
    texto: f.q,
  };
  const [lista, resumen] = await Promise.all([
    supabase.rpc("listar_ventas", {
      p: p({ ...filtros, estado: f.estado, limite: f.por, pagina: f.pagina }),
    }),
    supabase.rpc("resumen_ventas", { p: p(filtros) }),
  ]);
  const filas: FilaVenta[] = (lista.data ?? []).map((v) => ({
    id: v.id,
    numero: v.numero,
    fecha: v.created_at,
    total: v.total,
    pagado: v.pagado,
    estado: v.estado,
    clienteId: v.cliente_id,
    cliente: v.cliente_nombre,
    metodos: v.metodos ?? "",
  }));
  return {
    filas,
    total: Number(lista.data?.[0]?.filas ?? 0),
    resumen: resumen.data as unknown as Record<
      "todas" | "parciales" | "anuladas",
      Tarjeta
    >,
  };
}

export const esquemaFiltrosPagos = z.object({
  desde: fecha,
  hasta: fecha,
  tipo: z.enum(["", "abonos", "anuladas"]).catch(""),
  metodo: uuidOVacio,
  q: z.string().trim().max(60).catch(""),
  pagina,
  por: porPagina,
});
export type FiltrosPagos = z.output<typeof esquemaFiltrosPagos>;

export interface FilaPago {
  id: string;
  fecha: string;
  comprobante: string | null;
  monto: number;
  propina: number;
  metodo: string;
  ventaId: string;
  venta: string;
  ventaEstado: EstadoVenta;
  abono: boolean;
  cliente: string;
}

export interface ResumenPagos {
  todas: Tarjeta;
  abonos: Tarjeta;
  anuladas: Tarjeta;
  metodos: { nombre: string; tipo: TipoMetodo; monto: number; n: number }[];
}

export async function listarPagos(f: FiltrosPagos) {
  const supabase = await crearClienteServidor();
  const filtros = {
    desde: f.desde,
    hasta: f.hasta,
    metodoId: f.metodo,
    texto: f.q,
  };
  const [lista, resumen] = await Promise.all([
    supabase.rpc("listar_pagos", {
      p: p({ ...filtros, tipo: f.tipo, limite: f.por, pagina: f.pagina }),
    }),
    supabase.rpc("resumen_pagos", { p: p(filtros) }),
  ]);
  const filas: FilaPago[] = (lista.data ?? []).map((x) => ({
    id: x.id,
    fecha: x.created_at,
    comprobante: x.comprobante,
    monto: x.monto,
    propina: x.propina,
    metodo: x.metodo,
    ventaId: x.venta_id,
    venta: x.venta_numero,
    ventaEstado: x.venta_estado,
    abono: x.abono,
    cliente: x.cliente_nombre,
  }));
  return {
    filas,
    total: Number(lista.data?.[0]?.filas ?? 0),
    resumen: resumen.data as unknown as ResumenPagos,
  };
}

export async function metodosDePago() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("metodos_pago")
    .select("id, nombre")
    .order("orden");
  return data ?? [];
}

export async function profesionalesActivos() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("profesionales")
    .select("id, nombre")
    .eq("activo", true)
    .order("orden");
  return data ?? [];
}

/** Detalle de una venta para la ventana "ver" (Detalle, Transacciones y comprobante). */
export async function leerDetalleVenta(
  id: string,
): Promise<DetalleVenta | null> {
  const supabase = await crearClienteServidor();
  const { data: v } = await supabase
    .from("ventas")
    .select(
      `id, numero, created_at, estado, subtotal, descuento, total, pagado, motivo_anulacion, anulada_at,
       clientes(id, nombre, apellido, correo, telefono),
       creada:miembros!ventas_creada_por_fkey(nombre), anulada:miembros!ventas_anulada_por_fkey(nombre),
       venta_items(descripcion, cantidad, precio_unitario, total, profesionales(nombre), citas(fecha, hora_inicio)),
       pagos(created_at, monto, recibido, comprobante, abono, metodos_pago(nombre))`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!v) return null;
  return {
    id: v.id,
    numero: v.numero ?? "",
    fecha: v.created_at,
    estado: v.estado,
    cliente: v.clientes
      ? {
          id: v.clientes.id,
          nombre: `${v.clientes.nombre} ${v.clientes.apellido}`,
          correo: v.clientes.correo,
          telefono: v.clientes.telefono,
        }
      : null,
    items: v.venta_items.map((i) => ({
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      precioUnitario: i.precio_unitario,
      total: i.total,
      profesional: i.profesionales?.nombre ?? null,
      cita: i.citas
        ? `${i.citas.fecha} ${i.citas.hora_inicio.slice(0, 5)}`
        : null,
    })),
    pagos: [...v.pagos]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((x) => ({
        fecha: x.created_at,
        metodo: x.metodos_pago?.nombre ?? "Método",
        monto: x.monto,
        recibido: x.recibido,
        comprobante: x.comprobante,
        abono: x.abono,
      })),
    subtotal: v.subtotal,
    descuento: v.descuento,
    total: v.total,
    pagado: v.pagado,
    creadaPor: v.creada?.nombre ?? null,
    motivoAnulacion: v.motivo_anulacion,
    anuladaAt: v.anulada_at,
    anuladaPor: v.anulada?.nombre ?? null,
  };
}

/** Hasta cuántas filas trae la lista del celular (si hay más, se avisa que el total es de las cargadas). */
const TOPE_CELULAR = 500;

/** Ventas del período para la lista del celular, de la más nueva a la más vieja, con sus pagos. */
export async function ventasCelular(f: {
  desde: string;
  hasta: string;
  q: string;
}) {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .rpc("ventas_filtradas", {
      p: p({ desde: f.desde, hasta: f.hasta, texto: f.q }),
    })
    .select(
      "id, numero, correlativo, created_at, total, pagado, estado, clientes(nombre, apellido), pagos(monto, metodos_pago(nombre, tipo))",
    )
    .order("created_at", { ascending: false })
    .order("correlativo", { ascending: false })
    .limit(TOPE_CELULAR + 1);
  if (error) throw new Error("No pudimos cargar las ventas");
  const filas: VentaCelular[] = (data ?? [])
    .slice(0, TOPE_CELULAR)
    .map((v) => ({
      id: v.id,
      numero: v.numero ?? String(v.correlativo),
      fecha: v.created_at,
      total: v.total,
      pagado: v.pagado,
      estado: v.estado,
      cliente: v.clientes
        ? `${v.clientes.nombre} ${v.clientes.apellido}`
        : null,
      pagos: v.pagos.map((x) => ({
        monto: x.monto,
        metodo: x.metodos_pago?.nombre ?? "Pago",
        tipo: (x.metodos_pago?.tipo ?? "otro") as TipoMetodo,
      })),
    }));
  return { filas, cortada: (data?.length ?? 0) > TOPE_CELULAR };
}

/** Propinas del período (pagos con propina de ventas no anuladas), para la pestaña Propinas. */
export async function propinasCelular(f: {
  desde: string;
  hasta: string;
  q: string;
}) {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .rpc("pagos_filtrados", {
      p: p({ desde: f.desde, hasta: f.hasta, texto: f.q }),
    })
    .gt("propina", 0)
    .neq("venta_estado", "anulada")
    .order("created_at", { ascending: false })
    .limit(TOPE_CELULAR + 1);
  if (error) throw new Error("No pudimos cargar las propinas");
  const filas: PropinaCelular[] = (data ?? [])
    .slice(0, TOPE_CELULAR)
    .map((x) => ({
      id: x.id,
      fecha: x.created_at,
      propina: x.propina,
      cliente: x.cliente_nombre,
      metodo: x.metodo,
      tipo: x.metodo_tipo as TipoMetodo,
      ventaId: x.venta_id,
      numero: x.venta_numero,
    }));
  return { filas, cortada: (data?.length ?? 0) > TOPE_CELULAR };
}
