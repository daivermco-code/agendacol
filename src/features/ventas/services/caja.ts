import "server-only";
import { addDays, format, parseISO } from "date-fns";
import { z } from "zod";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import type { Database } from "@/types/database";
import { MOVIMIENTOS_POR_PAGINA, PESTANAS_CAJA } from "../lib/caja";

type TipoMovimiento = Database["public"]["Enums"]["tipo_movimiento"];

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .catch("");

/** Inicio del día en Bogotá (sin horario de verano: siempre -05:00). */
const inicioDia = (f: string) => `${f}T00:00:00-05:00`;
const diaSiguiente = (f: string) =>
  format(addDays(parseISO(f), 1), "yyyy-MM-dd");

export const esquemaFiltrosCaja = z.object({
  desde: fecha,
  hasta: fecha,
  tipo: z.enum(PESTANAS_CAJA).catch(""),
  local: z.string().uuid().or(z.literal("")).catch(""),
  pagina: z.coerce.number().int().min(1).catch(1),
});
export type FiltrosCaja = z.output<typeof esquemaFiltrosCaja>;

export interface ResumenCaja {
  efectivoEnCaja: number;
  ventas: number;
  abonos: number;
  ingresos: number;
  egresos: number;
  traspasos: number;
  rectificaciones: number;
  resultado: number;
  efectivoPeriodo: number;
}

export interface FilaMovimiento {
  id: string;
  fecha: string;
  tipo: TipoMovimiento;
  monto: number;
  efectivo: boolean;
  concepto: string;
  metodo: string | null;
  contado: number | null;
  ventaId: string | null;
  quien: string | null;
}


export async function leerCaja(f: FiltrosCaja & { local: string }) {
  const supabase = await crearClienteServidor();
  let q = supabase
    .from("movimientos_caja")
    .select(
      "id, created_at, tipo, monto, efectivo, concepto, metodo, contado, venta_id, miembros(nombre)",
      {
        count: "exact",
      },
    )
    .eq("local_id", f.local)
    .gte("created_at", inicioDia(f.desde))
    .lt("created_at", inicioDia(diaSiguiente(f.hasta)));
  if (f.tipo === "ventas")
    q = q.eq("tipo", "ingreso").not("venta_id", "is", null);
  else if (f.tipo === "ingreso")
    q = q.eq("tipo", "ingreso").is("venta_id", null);
  else if (f.tipo) q = q.eq("tipo", f.tipo);
  const desde = (f.pagina - 1) * MOVIMIENTOS_POR_PAGINA;
  const [movimientos, resumen] = await Promise.all([
    q
      .order("created_at", { ascending: false })
      .range(desde, desde + MOVIMIENTOS_POR_PAGINA - 1),
    supabase.rpc("resumen_caja", {
      p_local: f.local,
      p_desde: f.desde,
      p_hasta: f.hasta,
    }),
  ]);
  const filas: FilaMovimiento[] = (movimientos.data ?? []).map((m) => ({
    id: m.id,
    fecha: m.created_at,
    tipo: m.tipo,
    monto: m.monto,
    efectivo: m.efectivo,
    concepto: m.concepto,
    metodo: m.metodo,
    contado: m.contado,
    ventaId: m.venta_id,
    quien: m.miembros?.nombre ?? null,
  }));
  return {
    filas,
    total: movimientos.count ?? 0,
    resumen: resumen.data as unknown as ResumenCaja,
  };
}

export async function localesActivos() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("locales")
    .select("id, nombre")
    .eq("activo", true)
    .order("created_at");
  return data ?? [];
}

export const esquemaFiltrosCobros = z.object({
  desde: fecha,
  hasta: fecha,
  profesional: z.string().uuid().or(z.literal("")).catch(""),
});
export type FiltrosCobros = z.output<typeof esquemaFiltrosCobros>;

export interface FilaCobro {
  tipo: "cita" | "saldo";
  citaId: string | null;
  ventaId: string | null;
  numero: string | null;
  fecha: string;
  hora: string;
  clienteId: string | null;
  cliente: string;
  descripcion: string;
  profesionalId: string | null;
  estado: string;
  monto: number;
  total: number;
}

/** Citas atendidas (o en "No asistió") sin venta y ventas con saldo (cobros_pendientes). */
export async function leerCobros(f: FiltrosCobros): Promise<FilaCobro[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("cobros_pendientes", {
    p_desde: f.desde,
    p_hasta: f.hasta,
    ...(f.profesional ? { p_profesional: f.profesional } : {}),
  });
  return (data ?? []).map((c) => ({
    tipo: c.tipo === "saldo" ? "saldo" : "cita",
    citaId: c.cita_id,
    ventaId: c.venta_id,
    numero: c.numero,
    fecha: c.fecha,
    hora: c.hora.slice(0, 5),
    clienteId: c.cliente_id,
    cliente: c.cliente_nombre,
    descripcion: c.descripcion ?? "",
    profesionalId: c.profesional_id,
    estado: c.estado,
    monto: c.monto,
    total: c.total,
  }));
}

export interface Numeracion {
  prefijo: string;
  siguiente: number;
  ultimo: string | null;
  historial: {
    id: string;
    fecha: string;
    antes: string;
    despues: string;
    quien: string | null;
  }[];
}

export async function leerNumeracion(): Promise<Numeracion> {
  const supabase = await crearClienteServidor();
  const [ajustes, ultima, historial] = await Promise.all([
    supabase
      .from("ajustes")
      .select("venta_prefijo, venta_siguiente")
      .maybeSingle(),
    supabase
      .from("ventas")
      .select("numero")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("numeracion_cambios")
      .select(
        "id, created_at, prefijo_antes, siguiente_antes, prefijo, siguiente, miembros(nombre)",
      )
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  return {
    prefijo: ajustes.data?.venta_prefijo ?? "",
    siguiente: ajustes.data?.venta_siguiente ?? 1001,
    ultimo: ultima.data?.numero ?? null,
    historial: (historial.data ?? []).map((h) => ({
      id: h.id,
      fecha: h.created_at,
      antes: `${h.prefijo_antes}${h.siguiente_antes}`,
      despues: `${h.prefijo}${h.siguiente}`,
      quien: h.miembros?.nombre ?? null,
    })),
  };
}
