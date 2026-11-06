import "server-only";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { Miembro } from "@/features/auth/services/miembro";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import { pesos } from "@/shared/lib/formato";
import { puede } from "@/shared/lib/permisos";
import { diaEnZona, type Aviso } from "../lib/avisos";

/** Cuántos días hacia atrás se miran. */
export const DIAS_AVISOS = 14;
/** Tope de avisos con fecha en la pantalla (el stock bajo va aparte: es un estado que sigue vigente). */
const MAXIMO = 200;
/** Marca que deja la cancelación desde el enlace de la cita (`publico_cancelar_cita`, 0013). */
const CANCELA_CLIENTE = "Cancelada por el cliente";

const nombre = (c: { nombre: string; apellido: string } | null) =>
  c ? `${c.nombre} ${c.apellido}`.trim() : "Un cliente";

/** "sáb 7 nov a las 09:00". */
function cuandoCita(fecha: string, hora: string): string {
  const dia = format(parseISO(fecha), "EEE d MMM", { locale: es }).replaceAll(
    ".",
    "",
  );
  return `${dia} a las ${hora.slice(0, 5)}`;
}

const agenda = (fecha: string) => `/agenda?vista=dia&fecha=${fecha}`;

interface CitaAviso {
  id: string;
  reserva_id: string | null;
  fecha: string;
  hora_inicio: string;
}

/**
 * Varias citas reservadas juntas (mismo `reserva_id`) son un solo aviso. Cada grupo va de la primera cita a la
 * última: las de una reserva tienen el mismo `created_at`, así que el orden de la consulta no lo dice.
 */
function porReserva<T extends CitaAviso>(filas: T[]): T[][] {
  const grupos = new Map<string, T[]>();
  for (const f of filas) {
    const clave = f.reserva_id ?? f.id;
    grupos.set(clave, [...(grupos.get(clave) ?? []), f]);
  }
  return [...grupos.values()].map((g) =>
    g.sort((a, b) =>
      `${a.fecha} ${a.hora_inicio}`.localeCompare(
        `${b.fecha} ${b.hora_inicio}`,
      ),
    ),
  );
}

const yMas = (n: number) =>
  n > 1 ? ` y ${n - 1} ${n === 2 ? "servicio más" : "servicios más"}` : "";

/**
 * Avisos de los últimos 14 días que el rol puede ver (T-12.10): reservas en línea, cancelaciones del cliente,
 * lista de espera y respuestas por WhatsApp; pagos con `ver_ventas`; stock bajo con `administrar`.
 */
export async function avisosDe(miembro: Miembro): Promise<Aviso[]> {
  const supabase = await crearClienteServidor();
  const desde = new Date(Date.now() - DIAS_AVISOS * 86_400_000).toISOString();
  const verPagos = puede(miembro.rol, "ver_ventas");
  const verStock = puede(miembro.rol, "administrar");

  const [reservas, canceladas, espera, respuestas, pagos, productos] =
    await Promise.all([
      supabase
        .from("citas")
        .select(
          "id, reserva_id, created_at, fecha, hora_inicio, clientes(nombre, apellido), servicios(nombre)",
        )
        .eq("origen", "en_linea")
        .gte("created_at", desde)
        .order("created_at", { ascending: false })
        .limit(400),
      supabase
        .from("citas")
        .select(
          "id, reserva_id, updated_at, fecha, hora_inicio, clientes(nombre, apellido), servicios(nombre)",
        )
        .eq("estado", "cancelado")
        .like("motivo_cancelacion", `${CANCELA_CLIENTE}%`)
        .gte("updated_at", desde)
        .order("updated_at", { ascending: false })
        .limit(200),
      supabase.rpc("lista_espera_equipo"),
      supabase
        .from("avisos_demo")
        .select("id, created_at, destinatario, cuerpo")
        .eq("tipo", "respuesta")
        .gte("created_at", desde)
        .order("created_at", { ascending: false })
        .limit(50),
      verPagos
        ? supabase
            .from("pagos")
            .select(
              "id, created_at, monto, abono, metodos_pago(nombre), ventas(numero, clientes(nombre, apellido))",
            )
            .gte("created_at", desde)
            .order("created_at", { ascending: false })
            .limit(100)
        : null,
      verStock
        ? supabase
            .from("productos")
            .select("id, nombre, existencias, stock_minimo, updated_at")
            .eq("activo", true)
            .gt("stock_minimo", 0)
            .limit(200)
        : null,
    ]);
  const error =
    reservas.error ??
    canceladas.error ??
    espera.error ??
    respuestas.error ??
    pagos?.error ??
    productos?.error;
  if (error) throw new Error("No se pudieron leer los avisos");

  const avisos: Aviso[] = [];
  const stock: Aviso[] = [];

  for (const grupo of porReserva(reservas.data ?? [])) {
    const [c] = grupo;
    avisos.push({
      id: `reserva-${c.reserva_id ?? c.id}`,
      tipo: "reserva",
      fecha: c.created_at,
      titulo: "Nueva reserva en línea",
      detalle: `${nombre(c.clientes)} reservó ${c.servicios?.nombre ?? "un servicio"}${yMas(grupo.length)} para el ${cuandoCita(c.fecha, c.hora_inicio)}`,
      enlace: agenda(c.fecha),
    });
  }

  for (const grupo of porReserva(canceladas.data ?? [])) {
    const [c] = grupo;
    avisos.push({
      id: `cancelacion-${c.reserva_id ?? c.id}`,
      tipo: "cancelacion",
      fecha: c.updated_at,
      titulo: "El cliente canceló",
      detalle: `${nombre(c.clientes)} canceló ${c.servicios?.nombre ?? "su cita"}${yMas(grupo.length)} del ${cuandoCita(c.fecha, c.hora_inicio)}`,
      enlace: agenda(c.fecha),
    });
  }

  const dia = (fecha: string) =>
    format(parseISO(fecha), "EEEE d 'de' MMMM", { locale: es });
  for (const e of espera.data ?? []) {
    if (e.created_at >= desde)
      avisos.push({
        id: `espera-${e.id}`,
        tipo: "espera",
        fecha: e.created_at,
        titulo: "Nuevo en la lista de espera",
        detalle: `${e.cliente} espera una hora para ${e.servicios} el ${dia(e.fecha)}`,
        enlace: "/clientes/lista-espera",
      });
    if (e.avisado_at && e.avisado_at >= desde)
      avisos.push({
        id: `espera-avisada-${e.id}`,
        tipo: "espera_avisada",
        fecha: e.avisado_at,
        titulo: "Se liberó una hora",
        detalle: `Le avisamos a ${e.cliente}, de la lista de espera, que hay hora el ${dia(e.fecha)}`,
        enlace: "/clientes/lista-espera",
      });
  }

  for (const r of respuestas.data ?? [])
    avisos.push({
      id: `respuesta-${r.id}`,
      tipo: "respuesta",
      fecha: r.created_at,
      titulo: "Respuesta por WhatsApp",
      detalle: `${r.destinatario ?? "Un cliente"}: ${r.cuerpo}`,
      enlace: "/demo/buzon",
    });

  for (const p of pagos?.data ?? []) {
    const cliente = p.ventas?.clientes ? nombre(p.ventas.clientes) : null;
    // Transacciones filtra por el día del pago en Bogotá (un abono puede ser de una venta de otro día).
    const dia = diaEnZona(p.created_at);
    avisos.push({
      id: `pago-${p.id}`,
      tipo: "pago",
      fecha: p.created_at,
      titulo: p.abono ? "Abono recibido" : "Pago recibido",
      detalle: `${pesos(Number(p.monto))} en ${p.metodos_pago?.nombre ?? "otro método"}${cliente ? ` de ${cliente}` : ""}${p.ventas ? ` · venta N.º ${p.ventas.numero}` : ""}`,
      enlace: `/ventas/transacciones?desde=${dia}&hasta=${dia}`,
    });
  }

  for (const p of productos?.data ?? []) {
    if (p.existencias > p.stock_minimo) continue;
    stock.push({
      id: `stock-${p.id}`,
      tipo: "stock",
      // Sin fecha de cuándo bajó: la del último cambio del producto.
      fecha: p.updated_at,
      titulo: p.existencias <= 0 ? "Producto agotado" : "Stock bajo",
      detalle:
        p.existencias <= 0
          ? `${p.nombre} se agotó (mínimo ${p.stock_minimo})`
          : `Quedan ${p.existencias} de ${p.nombre} (mínimo ${p.stock_minimo})`,
      enlace: "/administracion/productos?bajo=1",
    });
  }

  const reciente = (a: Aviso, b: Aviso) =>
    new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
  return [...avisos.sort(reciente).slice(0, MAXIMO), ...stock].sort(reciente);
}
