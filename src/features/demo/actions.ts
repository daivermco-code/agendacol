"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerMiembro } from "@/features/auth/services/miembro";
import { puede } from "@/shared/lib/permisos";
import { crearClienteServidor } from "@/shared/lib/supabase/server";

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

/** Vacía y vuelve a sembrar solo el negocio de demo (función `reiniciar_demo` en la base). */
export async function reiniciarDemo(): Promise<ResultadoAccion> {
  const miembro = await obtenerMiembro();
  if (!miembro || !puede(miembro.rol, "reiniciar_demo")) {
    return { ok: false, error: "No tienes permiso para reiniciar la demo" };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("reiniciar_demo");
  if (error) return { ok: false, error: "No se pudo reiniciar la demo" };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Hace de cliente: responde "SÍ, confirmo" a un WhatsApp y confirma su reserva (función `responder_aviso_demo`). */
export async function responderAviso(
  avisoId: unknown,
): Promise<ResultadoAccion> {
  const miembro = await obtenerMiembro();
  if (!miembro || !puede(miembro.rol, "ver_buzon")) {
    return { ok: false, error: "No tienes permiso para usar el buzón" };
  }
  const id = z.string().uuid().safeParse(avisoId);
  if (!id.success) return { ok: false, error: "Aviso no válido" };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("responder_aviso_demo", {
    p_aviso: id.data,
  });
  const r = data as unknown as {
    ok: boolean;
    error?: { message: string };
  } | null;
  if (error || !r) return { ok: false, error: "No se pudo responder" };
  if (!r.ok)
    return { ok: false, error: r.error?.message ?? "No se pudo responder" };

  revalidatePath("/demo/buzon");
  return { ok: true };
}
