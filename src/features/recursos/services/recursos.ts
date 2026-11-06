import "server-only";
import { hoyEnBogota } from "@/features/ventas/services/panel";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import type { LocalRecurso, Recurso, ServicioRecurso } from "../types";

/** Recursos de todos los locales con los servicios que los usan y cuántas citas próximas los ocupan. */
export async function listarRecursos(): Promise<Recurso[]> {
  const supabase = await crearClienteServidor();
  const [{ data: recursos }, { data: servicios }, { data: citas }] =
    await Promise.all([
      supabase
        .from("recursos")
        .select("id, nombre, descripcion, activo, local_id, locales(nombre)")
        .order("orden")
        .order("nombre"),
      supabase.from("servicios").select("id, recursos"),
      supabase
        .from("citas")
        .select("recurso_id")
        .not("recurso_id", "is", null)
        .neq("estado", "cancelado")
        .gte("fecha", hoyEnBogota()),
    ]);
  return (recursos ?? []).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    descripcion: r.descripcion,
    activo: r.activo,
    localId: r.local_id,
    localNombre: r.locales?.nombre ?? "",
    servicios: (servicios ?? [])
      .filter((s) => s.recursos.includes(r.id))
      .map((s) => s.id),
    proximas: (citas ?? []).filter((c) => c.recurso_id === r.id).length,
  }));
}

/** Servicios que se agendan como cita (los que pueden usar un recurso). */
export async function serviciosParaRecurso(): Promise<ServicioRecurso[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("servicios")
    .select("id, nombre, categorias(nombre)")
    .eq("activo", true)
    .in("tipo", ["servicio", "sesiones"])
    .order("orden")
    .order("nombre");
  return (data ?? []).map((s) => ({
    id: s.id,
    nombre: s.nombre,
    categoria: s.categorias?.nombre ?? "",
  }));
}

export async function localesParaRecurso(): Promise<LocalRecurso[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("locales")
    .select("id, nombre")
    .eq("activo", true)
    .order("created_at");
  return data ?? [];
}
