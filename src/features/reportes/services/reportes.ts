import "server-only";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import type { EstadoCita } from "@/features/agenda/lib/estados";
import type {
  EstadisticasReservas,
  EstadisticasVentas,
  PeriodoReporte,
} from "../types";

interface Rango {
  desde: string;
  hasta: string;
}

/** Cifras de un período y, si hay comparación, las del período con que se compara. */
export interface Comparadas<T> {
  actual: T;
  anterior: T | null;
}

export async function reservas(r: Rango): Promise<EstadisticasReservas> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("estadisticas_reservas", {
    p_desde: r.desde,
    p_hasta: r.hasta,
  });
  if (error || !data) throw new Error("No se pudo leer el reporte de reservas");
  return data as unknown as EstadisticasReservas;
}

export async function ventas(r: Rango): Promise<EstadisticasVentas> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("estadisticas_ventas", {
    p_desde: r.desde,
    p_hasta: r.hasta,
  });
  if (error || !data) throw new Error("No se pudo leer el reporte de ventas");
  return data as unknown as EstadisticasVentas;
}

export async function reservasComparadas(
  p: PeriodoReporte,
): Promise<Comparadas<EstadisticasReservas>> {
  const [actual, anterior] = await Promise.all([
    reservas(p),
    p.anterior ? reservas(p.anterior) : null,
  ]);
  return { actual, anterior };
}

export async function ventasComparadas(
  p: PeriodoReporte,
): Promise<Comparadas<EstadisticasVentas>> {
  const [actual, anterior] = await Promise.all([
    ventas(p),
    p.anterior ? ventas(p.anterior) : null,
  ]);
  return { actual, anterior };
}

export interface CitaDeHoy {
  id: string;
  hora: string;
  estado: EstadoCita;
  cliente: string;
  clienteId: string;
  servicio: string;
  profesional: string;
  color: string;
}

/** Las citas de hoy que siguen en pie, por hora. */
export async function citasDeHoy(hoy: string): Promise<CitaDeHoy[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("citas")
    .select(
      "id, hora_inicio, estado, cliente_id, clientes(nombre, apellido), servicios(nombre), profesionales(nombre, color)",
    )
    .eq("fecha", hoy)
    .neq("estado", "cancelado")
    .order("hora_inicio")
    .limit(80);
  return (data ?? []).map((c) => ({
    id: c.id,
    hora: c.hora_inicio.slice(0, 5),
    estado: c.estado,
    cliente: c.clientes ? `${c.clientes.nombre} ${c.clientes.apellido}` : "",
    clienteId: c.cliente_id,
    servicio: c.servicios?.nombre ?? "",
    profesional: c.profesionales?.nombre ?? "",
    color: c.profesionales?.color ?? "#0E7490",
  }));
}

export interface Cumpleanero {
  id: string;
  nombre: string;
  telefono: string | null;
}

/** Clientes que cumplen años hoy (el filtro de cumpleaños de la base de clientes). */
export async function cumpleanosDeHoy(hoy: string): Promise<Cumpleanero[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("listar_clientes", {
    p: { cumpleDesde: hoy, cumpleHasta: hoy, limite: 20, orden: "nombre" },
  });
  return (data ?? []).map((c) => ({
    id: c.id,
    nombre: `${c.nombre} ${c.apellido}`,
    telefono: c.telefono,
  }));
}

export interface AvisosPeriodo {
  correo: number;
  whatsapp: number;
  recordatorios: number;
}

/** Avisos simulados (correo y WhatsApp) que salieron en el período; los recordatorios, aparte. */
export async function avisosDelPeriodo(r: Rango): Promise<AvisosPeriodo> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("avisos_demo")
    .select("canal, tipo")
    .gte("programado_para", `${r.desde}T00:00:00-05:00`)
    .lte("programado_para", `${r.hasta}T23:59:59-05:00`)
    .lte("programado_para", new Date().toISOString())
    .limit(2000);
  const filas = data ?? [];
  return {
    correo: filas.filter((a) => a.canal === "correo").length,
    whatsapp: filas.filter((a) => a.canal === "whatsapp").length,
    recordatorios: filas.filter((a) => a.tipo === "recordatorio").length,
  };
}

export interface ProductoBajo {
  id: string;
  nombre: string;
  existencias: number;
  minimo: number;
}

/** Productos activos con existencias en el mínimo o por debajo (los que tienen alerta). */
export async function stockBajo(): Promise<ProductoBajo[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("productos")
    .select("id, nombre, existencias, stock_minimo")
    .eq("activo", true)
    .gt("stock_minimo", 0)
    .order("existencias")
    .limit(200);
  return (data ?? [])
    .filter((p) => p.existencias <= p.stock_minimo)
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      existencias: p.existencias,
      minimo: p.stock_minimo,
    }));
}
