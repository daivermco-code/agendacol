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
import { esquemaPrograma } from "./schemas";

const ERROR_BASE = {
  ok: false,
  error: "No se pudo guardar. Intenta de nuevo.",
  code: "BASE",
} as const;

/** Prende o apaga la tarjeta y cambia cuántos sellos la llenan y el premio (los sellos ganados no se pierden). */
export async function guardarPrograma(
  entrada: unknown,
): Promise<ResultadoAccion> {
  const miembro = await miembroQuePuede("editar_ajustes");
  if (!miembro) return SIN_PERMISO;
  const p = esquemaPrograma.safeParse(entrada);
  if (!p.success) return primerError(p.error.issues);
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("ajustes")
    .update({
      sellos_activos: p.data.activo,
      sellos_meta: p.data.meta,
      sellos_premio: p.data.premio,
    })
    .eq("negocio_id", miembro.negocioId);
  if (error) return ERROR_BASE;
  revalidatePath("/clientes/fidelizacion");
  return { ok: true };
}

/** Entrega un premio ganado (lo hace la recepción al cobrar o el dueño). */
export async function entregarPremio(
  clienteId: unknown,
): Promise<ResultadoAccion> {
  if (!(await miembroQuePuede("cobrar"))) return SIN_PERMISO;
  const p = z.string().uuid().safeParse(clienteId);
  if (!p.success) return primerError(p.error.issues);
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("canjear_premio", {
    p_cliente: p.data,
  });
  if (error || !data) return ERROR_BASE;
  const r = data as unknown as { ok: boolean; error?: { message: string } };
  if (!r.ok)
    return {
      ok: false,
      error: r.error?.message ?? ERROR_BASE.error,
      code: "VALIDACION",
    };
  revalidatePath("/clientes/fidelizacion");
  revalidatePath(`/clientes/${p.data}`);
  return { ok: true };
}
