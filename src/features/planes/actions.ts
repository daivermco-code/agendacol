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
import { esquemaPlan, esquemaUsarBono } from "./schemas";
import { listarBonos } from "./services/planes";
import type { Bono } from "./types";

const ERROR_BASE = {
  ok: false,
  error: "No se pudo guardar. Intenta de nuevo.",
  code: "BASE",
} as const;

interface RespuestaBase {
  ok: boolean;
  error?: { code: string; message: string };
}

/** Crea o edita un plan del catálogo (solo el dueño; RLS lo vuelve a revisar). */
export async function guardarPlan(
  entrada: unknown,
): Promise<ResultadoAccion<{ id: string }>> {
  const miembro = await miembroQuePuede("administrar");
  if (!miembro) return SIN_PERMISO;
  const p = esquemaPlan.safeParse(entrada);
  if (!p.success) return primerError(p.error.issues);
  const d = p.data;
  const campos = {
    nombre: d.nombre,
    descripcion: d.descripcion || null,
    precio: d.precio,
    vigencia_dias: d.vigenciaDias,
    sesiones: d.sesiones,
    servicios: d.servicios,
    activo: d.activo,
  };
  const supabase = await crearClienteServidor();
  const { data, error } = d.id
    ? await supabase
        .from("planes")
        .update(campos)
        .eq("id", d.id)
        .select("id")
        .single()
    : await supabase
        .from("planes")
        .insert({ ...campos, negocio_id: miembro.negocioId })
        .select("id")
        .single();
  if (error?.code === "23505")
    return {
      ok: false,
      error: "Ya hay un plan con ese nombre",
      code: "VALIDACION",
    };
  if (error || !data) return ERROR_BASE;
  revalidatePath("/administracion/planes");
  return { ok: true, datos: { id: data.id } };
}

/** Planes del cliente de una cita que todavía sirven (activos), para ofrecerlos en la ficha de la cita. */
export async function bonosDeCliente(
  clienteId: unknown,
): Promise<ResultadoAccion<Bono[]>> {
  if (!(await miembroQuePuede("crear_cita"))) return SIN_PERMISO;
  const id = z.string().uuid().safeParse(clienteId);
  if (!id.success)
    return { ok: false, error: "Cliente no válido", code: "VALIDACION" };
  try {
    return { ok: true, datos: await listarBonos(id.data) };
  } catch {
    return ERROR_BASE;
  }
}

async function llamarBono(
  funcion: "usar_bono" | "soltar_bono",
  args: { p_cita: string; p_bono?: string },
): Promise<ResultadoAccion> {
  const supabase = await crearClienteServidor();
  const { data, error } =
    funcion === "usar_bono"
      ? await supabase.rpc("usar_bono", {
          p_cita: args.p_cita,
          p_bono: args.p_bono ?? "",
        })
      : await supabase.rpc("soltar_bono", { p_cita: args.p_cita });
  if (error || !data) return ERROR_BASE;
  const r = data as unknown as RespuestaBase;
  if (!r.ok)
    return {
      ok: false,
      error: r.error?.message ?? ERROR_BASE.error,
      code: "VALIDACION",
    };
  revalidatePath("/ventas/planes");
  return { ok: true };
}

/** La cita queda incluida en el plan del cliente ($0) y descuenta una de sus citas. */
export async function usarBono(entrada: unknown): Promise<ResultadoAccion> {
  if (!(await miembroQuePuede("crear_cita"))) return SIN_PERMISO;
  const p = esquemaUsarBono.safeParse(entrada);
  if (!p.success) return primerError(p.error.issues);
  return llamarBono("usar_bono", {
    p_cita: p.data.citaId,
    p_bono: p.data.bonoId,
  });
}

/** Saca la cita del plan: vuelve al precio del servicio y el plan recupera la cita. */
export async function soltarBono(citaId: unknown): Promise<ResultadoAccion> {
  if (!(await miembroQuePuede("crear_cita"))) return SIN_PERMISO;
  const id = z.string().uuid().safeParse(citaId);
  if (!id.success)
    return { ok: false, error: "Cita no válida", code: "VALIDACION" };
  return llamarBono("soltar_bono", { p_cita: id.data });
}
