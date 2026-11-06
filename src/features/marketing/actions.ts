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
import {
  esquemaAudiencia,
  esquemaCampana,
  esquemaFiltro,
  esquemaSuscripcion,
} from "./schemas";
import { conteoDe } from "./services/marketing";
import type { Conteo } from "./types";

const ERROR_BASE = {
  ok: false,
  error: "No se pudo guardar. Intenta de nuevo.",
  code: "BASE",
} as const;
const RUTA = "/clientes/marketing";

/** Vista previa del formulario de audiencia: cuántos cumplen el filtro y cuántos recibirían el correo. */
export async function contarAudiencia(
  filtro: unknown,
): Promise<ResultadoAccion<Conteo>> {
  if (!(await miembroQuePuede("ver_marketing"))) return SIN_PERMISO;
  const p = esquemaFiltro.safeParse(filtro);
  if (!p.success) return primerError(p.error.issues);
  return { ok: true, datos: await conteoDe(p.data) };
}

export async function guardarAudiencia(
  entrada: unknown,
): Promise<ResultadoAccion> {
  const miembro = await miembroQuePuede("ver_marketing");
  if (!miembro) return SIN_PERMISO;
  const p = esquemaAudiencia.safeParse(entrada);
  if (!p.success) return primerError(p.error.issues);
  const { id, nombre, filtro } = p.data;
  const supabase = await crearClienteServidor();
  const { error } = id
    ? await supabase.from("audiencias").update({ nombre, filtro }).eq("id", id)
    : await supabase
        .from("audiencias")
        .insert({ negocio_id: miembro.negocioId, nombre, filtro });
  if (error?.code === "23505")
    return {
      ok: false,
      error: "Ya hay una audiencia con ese nombre",
      code: "VALIDACION",
    };
  if (error) return ERROR_BASE;
  revalidatePath(RUTA);
  return { ok: true };
}

/** Borra la audiencia; sus campañas quedan sin audiencia (irían a todos), por eso los borradores se avisan antes. */
export async function borrarAudiencia(id: unknown): Promise<ResultadoAccion> {
  if (!(await miembroQuePuede("ver_marketing"))) return SIN_PERMISO;
  const p = z.string().uuid().safeParse(id);
  if (!p.success) return primerError(p.error.issues);
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("audiencias").delete().eq("id", p.data);
  if (error) return ERROR_BASE;
  revalidatePath(RUTA);
  return { ok: true };
}

/** Crea o edita un borrador (RLS no deja tocar las enviadas). */
export async function guardarCampana(
  entrada: unknown,
): Promise<ResultadoAccion<{ id: string }>> {
  const miembro = await miembroQuePuede("ver_marketing");
  if (!miembro) return SIN_PERMISO;
  const p = esquemaCampana.safeParse(entrada);
  if (!p.success) return primerError(p.error.issues);
  const d = p.data;
  const campos = {
    audiencia_id: d.audienciaId,
    asunto: d.asunto,
    cuerpo: d.cuerpo,
  };
  const supabase = await crearClienteServidor();
  const { data, error } = d.id
    ? await supabase
        .from("campanas")
        .update(campos)
        .eq("id", d.id)
        .select("id")
        .single()
    : await supabase
        .from("campanas")
        .insert({ ...campos, negocio_id: miembro.negocioId })
        .select("id")
        .single();
  if (error || !data) return ERROR_BASE;
  revalidatePath(RUTA);
  return { ok: true, datos: { id: data.id } };
}

export async function borrarCampana(id: unknown): Promise<ResultadoAccion> {
  if (!(await miembroQuePuede("ver_marketing"))) return SIN_PERMISO;
  const p = z.string().uuid().safeParse(id);
  if (!p.success) return primerError(p.error.issues);
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("campanas").delete().eq("id", p.data);
  if (error) return ERROR_BASE;
  revalidatePath(RUTA);
  return { ok: true };
}

interface RespuestaEnvio {
  ok: boolean;
  destinatarios?: number;
  error?: { code: string; message: string };
}

/** Envía el borrador a su audiencia: los correos llegan al buzón de la demo. */
export async function enviarCampana(
  id: unknown,
): Promise<ResultadoAccion<{ destinatarios: number }>> {
  if (!(await miembroQuePuede("ver_marketing"))) return SIN_PERMISO;
  const p = z.string().uuid().safeParse(id);
  if (!p.success) return primerError(p.error.issues);
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("enviar_campana", {
    p_campana: p.data,
  });
  if (error || !data) return ERROR_BASE;
  const r = data as unknown as RespuestaEnvio;
  if (!r.ok)
    return {
      ok: false,
      error: r.error?.message ?? ERROR_BASE.error,
      code: "VALIDACION",
    };
  revalidatePath(RUTA);
  revalidatePath("/demo/buzon");
  return { ok: true, datos: { destinatarios: r.destinatarios ?? 0 } };
}

/** Suprime (o vuelve a dejar) los correos de campaña de un cliente. Los avisos de sus citas siguen llegando. */
export async function cambiarSuscripcion(
  entrada: unknown,
): Promise<ResultadoAccion> {
  if (!(await miembroQuePuede("ver_marketing"))) return SIN_PERMISO;
  const p = esquemaSuscripcion.safeParse(entrada);
  if (!p.success) return primerError(p.error.issues);
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("clientes")
    .update({ recibe_campanas: p.data.recibe })
    .eq("id", p.data.clienteId);
  if (error) return ERROR_BASE;
  revalidatePath(RUTA);
  return { ok: true };
}
