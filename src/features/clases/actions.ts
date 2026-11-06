"use server";

import { z } from "zod";
import {
  miembroQuePuede,
  primerError,
  SIN_PERMISO,
  type ResultadoAccion,
} from "@/shared/lib/acciones";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import {
  esquemaClase,
  esquemaEstadoInscrito,
  esquemaInscribir,
  type EstadoInscrito,
} from "./schemas";
import type { Inscrito } from "./types";

const ERROR_BASE = {
  ok: false,
  error: "No se pudo guardar. Intenta de nuevo.",
  code: "BASE",
} as const;

interface RespuestaBase {
  ok: boolean;
  inscritos?: number;
  error?: { code: string; message: string };
}

/** Las funciones de clases responden {ok} o {ok:false, error:{message}}: esto lo pasa al formato de la app. */
async function responder(
  peticion: PromiseLike<{ data: unknown; error: unknown }>,
): Promise<ResultadoAccion> {
  const { data, error } = await peticion;
  if (error || !data) return ERROR_BASE;
  const r = data as RespuestaBase;
  if (!r.ok)
    return {
      ok: false,
      error: r.error?.message ?? ERROR_BASE.error,
      code: "VALIDACION",
    };
  return { ok: true };
}

/** Crea la clase (y sus repeticiones semanales) o edita una sesión. */
export async function guardarClase(entrada: unknown): Promise<ResultadoAccion> {
  if (!(await miembroQuePuede("crear_cita"))) return SIN_PERMISO;
  const p = esquemaClase.safeParse(entrada);
  if (!p.success) return primerError(p.error.issues);
  const d = p.data;
  if (!d.id && !d.servicioId)
    return { ok: false, error: "Elige la clase", code: "VALIDACION" };
  const supabase = await crearClienteServidor();
  return responder(
    supabase.rpc("guardar_clase", {
      p: {
        id: d.id,
        localId: d.localId,
        servicioId: d.servicioId,
        profesionalId: d.profesionalId,
        fecha: d.fecha,
        horaInicio: d.horaInicio,
        cupo: d.cupo,
        veces: d.veces,
        nota: d.nota,
      },
    }),
  );
}

export async function cancelarClase(
  claseId: unknown,
  motivo: unknown,
): Promise<ResultadoAccion> {
  if (!(await miembroQuePuede("crear_cita"))) return SIN_PERMISO;
  const id = z.string().uuid().safeParse(claseId);
  const m = z
    .string()
    .trim()
    .max(200)
    .safeParse(motivo ?? "");
  if (!id.success || !m.success)
    return { ok: false, error: "Clase no válida", code: "VALIDACION" };
  const supabase = await crearClienteServidor();
  return responder(
    supabase.rpc("cancelar_clase", { p_clase: id.data, p_motivo: m.data }),
  );
}

export async function inscribirCliente(
  entrada: unknown,
): Promise<ResultadoAccion> {
  if (!(await miembroQuePuede("crear_cita"))) return SIN_PERMISO;
  const p = esquemaInscribir.safeParse(entrada);
  if (!p.success) return primerError(p.error.issues);
  const supabase = await crearClienteServidor();
  return responder(
    supabase.rpc("inscribir_clase", {
      p_clase: p.data.claseId,
      p_cliente: p.data.clienteId,
      p_bono: p.data.bonoId ?? undefined,
    }),
  );
}

/** Asistencia o cancelación de un inscrito (el profesional marca la asistencia de sus clases). */
export async function cambiarInscrito(
  entrada: unknown,
): Promise<ResultadoAccion> {
  if (!(await miembroQuePuede("cambiar_estado_cita"))) return SIN_PERMISO;
  const p = esquemaEstadoInscrito.safeParse(entrada);
  if (!p.success) return primerError(p.error.issues);
  const supabase = await crearClienteServidor();
  return responder(
    supabase.rpc("estado_inscrito", {
      p_inscrito: p.data.inscritoId,
      p_estado: p.data.estado,
    }),
  );
}

/** La lista de la clase; el contacto solo le llega a dueño y recepción. */
export async function inscritosDeClase(
  claseId: unknown,
): Promise<ResultadoAccion<Inscrito[]>> {
  if (!(await miembroQuePuede("ver_agenda"))) return SIN_PERMISO;
  const id = z.string().uuid().safeParse(claseId);
  if (!id.success)
    return { ok: false, error: "Clase no válida", code: "VALIDACION" };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("inscritos_clase", {
    p_clase: id.data,
  });
  if (error) return ERROR_BASE;
  return {
    ok: true,
    datos: (data ?? []).map((i) => ({
      id: i.id,
      clienteId: i.cliente_id,
      cliente: i.cliente,
      telefono: i.telefono,
      estado: i.estado as EstadoInscrito,
      bonoId: i.bono_id,
      bonoNombre: i.bono_nombre,
    })),
  };
}
