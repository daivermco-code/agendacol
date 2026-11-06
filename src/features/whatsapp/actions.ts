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
import { llenarPlantilla } from "./lib/plantillas";
import { esquemaEnvio, esquemaPlantilla } from "./schemas";
import type { MensajeCita } from "./types";

const ERROR_BASE = {
  ok: false,
  error: "No se pudo guardar. Intenta de nuevo.",
  code: "BASE",
} as const;
const RUTA = "/administracion/whatsapp";

/** Crea o edita una plantilla (solo el dueño; RLS lo revisa). Las nuevas van al final. */
export async function guardarPlantilla(
  entrada: unknown,
): Promise<ResultadoAccion> {
  const miembro = await miembroQuePuede("administrar");
  if (!miembro) return SIN_PERMISO;
  const p = esquemaPlantilla.safeParse(entrada);
  if (!p.success) return primerError(p.error.issues);
  const { id, ...campos } = p.data;
  const supabase = await crearClienteServidor();
  let error;
  if (id) {
    ({ error } = await supabase
      .from("plantillas_whatsapp")
      .update(campos)
      .eq("id", id));
  } else {
    const { data: ultima } = await supabase
      .from("plantillas_whatsapp")
      .select("orden")
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    ({ error } = await supabase.from("plantillas_whatsapp").insert({
      ...campos,
      negocio_id: miembro.negocioId,
      orden: (ultima?.orden ?? 0) + 1,
    }));
  }
  if (error?.code === "23505")
    return {
      ok: false,
      error: "Ya hay una plantilla con ese nombre",
      code: "VALIDACION",
    };
  if (error) return ERROR_BASE;
  revalidatePath(RUTA);
  return { ok: true };
}

export async function borrarPlantilla(id: unknown): Promise<ResultadoAccion> {
  if (!(await miembroQuePuede("administrar"))) return SIN_PERMISO;
  const p = z.string().uuid().safeParse(id);
  if (!p.success) return primerError(p.error.issues);
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("plantillas_whatsapp")
    .delete()
    .eq("id", p.data);
  if (error) return ERROR_BASE;
  revalidatePath(RUTA);
  return { ok: true };
}

const DDMMYYYY = (fecha: string) => fecha.split("-").reverse().join("/");

/** Las plantillas activas ya llenadas con los datos de la cita, para elegir una en su ficha. */
export async function mensajesParaCita(
  citaId: unknown,
): Promise<ResultadoAccion<MensajeCita[]>> {
  if (!(await miembroQuePuede("crear_cita"))) return SIN_PERMISO;
  const p = z.string().uuid().safeParse(citaId);
  if (!p.success) return primerError(p.error.issues);
  const supabase = await crearClienteServidor();
  const [{ data: cita }, { data: plantillas }, { data: negocio }] =
    await Promise.all([
      supabase
        .from("citas")
        .select(
          "fecha, hora_inicio, clientes(nombre), servicios(nombre), profesionales(nombre), locales(nombre)",
        )
        .eq("id", p.data)
        .maybeSingle(),
      supabase
        .from("plantillas_whatsapp")
        .select("id, nombre, cuerpo")
        .eq("activo", true)
        .order("orden")
        .order("nombre"),
      supabase.from("negocios").select("nombre").maybeSingle(),
    ]);
  if (!cita) return ERROR_BASE;
  const datos = {
    cliente: cita.clientes?.nombre ?? "",
    servicio: cita.servicios?.nombre ?? "",
    fecha: DDMMYYYY(cita.fecha),
    hora: cita.hora_inicio.slice(0, 5),
    profesional: cita.profesionales?.nombre ?? "",
    local: cita.locales?.nombre ?? "",
    negocio: negocio?.nombre ?? "",
  };
  return {
    ok: true,
    datos: (plantillas ?? []).map((t) => ({
      id: t.id,
      nombre: t.nombre,
      texto: llenarPlantilla(t.cuerpo, datos),
    })),
  };
}

/** Manda la plantilla al WhatsApp del cliente de la cita (en la demo, al buzón). */
export async function enviarPlantilla(
  entrada: unknown,
): Promise<ResultadoAccion> {
  if (!(await miembroQuePuede("crear_cita"))) return SIN_PERMISO;
  const p = esquemaEnvio.safeParse(entrada);
  if (!p.success) return primerError(p.error.issues);
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("enviar_plantilla", {
    p_cita: p.data.citaId,
    p_plantilla: p.data.plantillaId,
  });
  if (error || !data) return ERROR_BASE;
  const r = data as unknown as { ok: boolean; error?: { message: string } };
  if (!r.ok)
    return {
      ok: false,
      error: r.error?.message ?? ERROR_BASE.error,
      code: "VALIDACION",
    };
  revalidatePath("/demo/buzon");
  return { ok: true };
}
