"use server";

import { revalidatePath } from "next/cache";
import {
  miembroQuePuede,
  primerError,
  SIN_PERMISO,
  type ResultadoAccion,
} from "@/shared/lib/acciones";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import { esquemaRecurso } from "./schemas";

const ERROR_BASE = {
  ok: false,
  error: "No se pudo guardar. Intenta de nuevo.",
  code: "BASE",
} as const;

/** Crea o edita un recurso y deja en cada servicio la lista de recursos que usa (solo el dueño; RLS lo revisa). */
export async function guardarRecurso(
  entrada: unknown,
): Promise<ResultadoAccion<{ id: string }>> {
  const miembro = await miembroQuePuede("administrar");
  if (!miembro) return SIN_PERMISO;
  const p = esquemaRecurso.safeParse(entrada);
  if (!p.success) return primerError(p.error.issues);
  const d = p.data;
  const campos = {
    local_id: d.localId,
    nombre: d.nombre,
    descripcion: d.descripcion || null,
    activo: d.activo,
  };
  const supabase = await crearClienteServidor();
  const { data, error } = d.id
    ? await supabase
        .from("recursos")
        .update(campos)
        .eq("id", d.id)
        .select("id")
        .single()
    : await supabase
        .from("recursos")
        .insert({ ...campos, negocio_id: miembro.negocioId })
        .select("id")
        .single();
  if (error || !data) return ERROR_BASE;

  const { data: servicios } = await supabase
    .from("servicios")
    .select("id, recursos");
  const cambios = (servicios ?? []).flatMap((s) => {
    const usa = s.recursos.includes(data.id);
    const debe = d.servicios.includes(s.id);
    if (usa === debe) return [];
    const recursos = debe
      ? [...s.recursos, data.id]
      : s.recursos.filter((r) => r !== data.id);
    return [supabase.from("servicios").update({ recursos }).eq("id", s.id)];
  });
  const resultados = await Promise.all(cambios);
  if (resultados.some((r) => r.error)) return ERROR_BASE;

  revalidatePath("/administracion/recursos");
  revalidatePath("/agenda");
  return { ok: true, datos: { id: data.id } };
}
