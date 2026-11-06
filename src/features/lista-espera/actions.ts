"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  miembroQuePuede,
  primerError,
  SIN_PERMISO,
  type ResultadoAccion,
} from "@/shared/lib/acciones";
import { crearClienteServidor } from "@/shared/lib/supabase/server";

/** Saca a un cliente de la lista de espera (ya agendó por teléfono, ya no le interesa…). */
export async function quitarDeEspera(id: unknown): Promise<ResultadoAccion> {
  if (!(await miembroQuePuede("crear_cita"))) return SIN_PERMISO;
  const p = z.string().uuid().safeParse(id);
  if (!p.success) return primerError(p.error.issues);
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("quitar_de_espera", {
    p_id: p.data,
  });
  if (error || !data)
    return {
      ok: false,
      error: "No se pudo quitar. Intenta de nuevo.",
      code: "BASE",
    };
  const r = data as unknown as { ok: boolean; error?: { message: string } };
  if (!r.ok)
    return {
      ok: false,
      error: r.error?.message ?? "No se pudo quitar",
      code: "VALIDACION",
    };
  revalidatePath("/clientes/lista-espera");
  return { ok: true };
}
