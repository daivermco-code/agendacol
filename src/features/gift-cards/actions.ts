"use server";

import { revalidatePath } from "next/cache";
import {
  miembroQuePuede,
  primerError,
  SIN_PERMISO,
  type ResultadoAccion,
} from "@/shared/lib/acciones";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import { esquemaModeloGiftCard } from "./schemas";

/** Crea o edita una gift card del catálogo (solo el dueño; RLS lo vuelve a revisar). */
export async function guardarModeloGiftCard(
  entrada: unknown,
): Promise<ResultadoAccion<{ id: string }>> {
  const miembro = await miembroQuePuede("administrar");
  if (!miembro) return SIN_PERMISO;
  const p = esquemaModeloGiftCard.safeParse(entrada);
  if (!p.success) return primerError(p.error.issues);
  const d = p.data;
  const campos = {
    nombre: d.nombre,
    monto: d.monto,
    precio: d.precio,
    vigencia_dias: d.vigenciaDias,
    color: d.color,
    activo: d.activo,
  };
  const supabase = await crearClienteServidor();
  const { data, error } = d.id
    ? await supabase
        .from("gift_card_modelos")
        .update(campos)
        .eq("id", d.id)
        .select("id")
        .single()
    : await supabase
        .from("gift_card_modelos")
        .insert({ ...campos, negocio_id: miembro.negocioId })
        .select("id")
        .single();
  if (error?.code === "23505")
    return {
      ok: false,
      error: "Ya hay una gift card con ese nombre",
      code: "VALIDACION",
    };
  if (error || !data)
    return {
      ok: false,
      error: "No se pudo guardar. Intenta de nuevo.",
      code: "BASE",
    };
  revalidatePath("/administracion/gift-cards");
  return { ok: true, datos: { id: data.id } };
}
