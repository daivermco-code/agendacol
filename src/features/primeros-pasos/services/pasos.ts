import "server-only";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import type { ClavePaso } from "../lib/pasos";

/**
 * Qué pasos de "Primeros pasos" ya están hechos: local con horario, servicios y profesionales activos, alguna
 * cita, alguna reserva que llegó por el sitio (prueba de que el enlace se compartió) y alguna venta. Basta con
 * saber si existe una fila, así que cada consulta trae a lo más una.
 */
export async function estadoDePasos(): Promise<Record<ClavePaso, boolean>> {
  const supabase = await crearClienteServidor();
  const [horario, servicios, equipo, cita, sitio, venta] = await Promise.all([
    supabase.from("horarios_local").select("local_id").limit(1),
    supabase.from("servicios").select("id").eq("activo", true).limit(1),
    supabase.from("profesionales").select("id").eq("activo", true).limit(1),
    supabase.from("citas").select("id").limit(1),
    supabase.from("citas").select("id").eq("origen", "en_linea").limit(1),
    supabase.from("ventas").select("id").limit(1),
  ]);
  const hay = (r: { data: unknown[] | null }) => (r.data?.length ?? 0) > 0;
  return {
    horario: hay(horario),
    servicios: hay(servicios),
    equipo: hay(equipo),
    cita: hay(cita),
    sitio: hay(sitio),
    venta: hay(venta),
  };
}

/** Avance n/6 para la barra superior. */
export async function contarPasosHechos(): Promise<number> {
  return Object.values(await estadoDePasos()).filter(Boolean).length;
}
