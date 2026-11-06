import "server-only";
import { crearClientePublico } from "@/shared/lib/supabase/publico";
import { leerAcceso } from "../lib/acceso";
import type { MisCitas } from "../types";

/** Lo que ve el cliente con su acceso vigente en este negocio; null si no entró (o entró en otro). */
export async function obtenerMisCitas(slug: string): Promise<MisCitas | null> {
  const token = await leerAcceso();
  if (!token) return null;
  const { data, error } = await crearClientePublico().rpc("publico_mis_citas", {
    p_token: token,
  });
  if (error) throw new Error("No se pudieron cargar tus citas");
  const mis = data as unknown as MisCitas | null;
  return mis?.negocio.slug === slug ? mis : null;
}
