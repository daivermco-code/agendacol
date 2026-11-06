import "server-only";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import type { Plantilla } from "../types";

/** Plantillas en su orden; las apagadas al final. */
export async function listarPlantillas(): Promise<Plantilla[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("plantillas_whatsapp")
    .select("id, nombre, cuerpo, activo")
    .order("activo", { ascending: false })
    .order("orden")
    .order("nombre");
  if (error) throw new Error(error.message);
  return data ?? [];
}
