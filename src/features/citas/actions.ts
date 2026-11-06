"use server";

import { z } from "zod";
import {
  ESTADOS_ACTIVOS,
  type EstadoCita,
} from "@/features/agenda/lib/estados";
import { miembroQuePuede } from "@/shared/lib/acciones";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import type { Json } from "@/types/database";
import { tramosBloqueo } from "./lib/serie";
import {
  esquemaAlcance,
  esquemaAlcanceCancelar,
  esquemaBloqueo,
  esquemaCita,
  type Alcance,
} from "./schemas";
import type {
  ResultadoGuardar,
  ResultadoRevision,
  ResultadoSimple,
  RevisionFecha,
} from "./types";

const SIN_PERMISO = {
  ok: false,
  error: "No tienes permiso para hacer esto",
} as const;
const ERROR_BASE = {
  ok: false,
  error: "No se pudo guardar. Intenta de nuevo.",
} as const;

/** Lo que devuelven guardar_cita, cambiar_estado_cita y cancelar_cita (jsonb). */
interface Respuesta {
  ok: boolean;
  citaIds?: string[];
  choques?: RevisionFecha[];
  revision?: RevisionFecha[];
  puedeForzar?: boolean;
  error?: { code: string; message: string; field?: string };
}

const id = z.string().uuid();

function errorDeZod(issues: ReadonlyArray<z.core.$ZodIssue>) {
  const i = issues[0];
  return {
    ok: false as const,
    error: i?.message ?? "Revisa los datos",
    campo: String(i?.path[0] ?? ""),
  };
}

async function llamarGuardar(
  p: Record<string, unknown>,
): Promise<Respuesta | null> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("guardar_cita", { p: p as Json });
  return error ? null : (data as unknown as Respuesta);
}

/**
 * Crea o edita una cita (también al moverla). Si choca devuelve los choques por fecha y si los ajustes
 * dejan forzarla; con `forzar` la guarda igual cuando se puede.
 */
export async function guardarCita(
  datos: unknown,
  opciones: { forzar?: boolean; alcance?: Alcance } = {},
): Promise<ResultadoGuardar> {
  if (!(await miembroQuePuede("crear_cita"))) return SIN_PERMISO;
  const p = esquemaCita.safeParse(datos);
  if (!p.success) return errorDeZod(p.error.issues);
  const alcance = esquemaAlcance.catch("solo_esta").parse(opciones.alcance);
  const r = await llamarGuardar({
    ...p.data,
    forzar: opciones.forzar === true,
    alcance,
  });
  if (!r) return ERROR_BASE;
  if (r.ok && r.citaIds) return { ok: true, citaIds: r.citaIds };
  if (r.choques)
    return {
      ok: false,
      choques: r.choques,
      puedeForzar: Boolean(r.puedeForzar),
    };
  return {
    ok: false,
    error: r.error?.message ?? ERROR_BASE.error,
    campo: r.error?.field,
  };
}

/** Revisa los choques de cada fecha sin guardar (vista previa de una serie). */
export async function revisarCita(datos: unknown): Promise<ResultadoRevision> {
  if (!(await miembroQuePuede("crear_cita"))) return SIN_PERMISO;
  const p = esquemaCita.safeParse(datos);
  if (!p.success) return errorDeZod(p.error.issues);
  const r = await llamarGuardar({ ...p.data, soloRevisar: true });
  if (!r) return ERROR_BASE;
  if (!r.ok || !r.revision)
    return { ok: false, error: r.error?.message ?? ERROR_BASE.error };
  return {
    ok: true,
    revision: r.revision,
    puedeForzar: Boolean(r.puedeForzar),
  };
}

const esquemaEstado = z.enum(ESTADOS_ACTIVOS as [EstadoCita, ...EstadoCita[]]);

/** Un clic en los puntos de la ficha. El profesional solo puede con sus citas (lo revisa la base). */
export async function cambiarEstadoCita(
  citaId: unknown,
  estado: unknown,
): Promise<ResultadoSimple> {
  if (!(await miembroQuePuede("cambiar_estado_cita"))) return SIN_PERMISO;
  const c = id.safeParse(citaId);
  const e = esquemaEstado.safeParse(estado);
  if (!c.success || !e.success) return { ok: false, error: "Estado no válido" };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("cambiar_estado_cita", {
    p_cita: c.data,
    p_estado: e.data,
  });
  const r = data as unknown as Respuesta | null;
  if (error || !r) return ERROR_BASE;
  return r.ok
    ? { ok: true }
    : { ok: false, error: r.error?.message ?? ERROR_BASE.error };
}

/** Cancela (queda en "Canceladas" y se avisa al cliente) con alcance de serie. */
export async function cancelarCita(
  citaId: unknown,
  alcance: unknown,
  motivo: unknown,
): Promise<ResultadoSimple> {
  if (!(await miembroQuePuede("crear_cita"))) return SIN_PERMISO;
  const c = id.safeParse(citaId);
  const a = esquemaAlcanceCancelar.safeParse(alcance);
  const m = z
    .string()
    .trim()
    .max(200, "Máximo 200 letras")
    .safeParse(motivo ?? "");
  if (!c.success || !a.success) return { ok: false, error: "Revisa la cita" };
  if (!m.success) return { ok: false, error: m.error.issues[0].message };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("cancelar_cita", {
    p_cita: c.data,
    p_alcance: a.data,
    p_motivo: m.data,
  });
  const r = data as unknown as Respuesta | null;
  if (error || !r) return ERROR_BASE;
  return r.ok
    ? { ok: true }
    : { ok: false, error: r.error?.message ?? ERROR_BASE.error };
}

/** Borra la cita (sin aviso ni historial); en una serie, también las siguientes o toda la serie. */
export async function eliminarCita(
  citaId: unknown,
  alcance: unknown,
): Promise<ResultadoSimple> {
  if (!(await miembroQuePuede("crear_cita"))) return SIN_PERMISO;
  const c = id.safeParse(citaId);
  const a = esquemaAlcanceCancelar.safeParse(alcance);
  if (!c.success || !a.success) return { ok: false, error: "Revisa la cita" };
  const supabase = await crearClienteServidor();
  const { data: cita } = await supabase
    .from("citas")
    .select("id, serie_id, fecha")
    .eq("id", c.data)
    .maybeSingle();
  if (!cita) return { ok: false, error: "La cita ya no existe" };
  let borrar = supabase.from("citas").delete();
  if (!cita.serie_id || a.data === "solo_esta")
    borrar = borrar.eq("id", cita.id);
  else {
    borrar = borrar.eq("serie_id", cita.serie_id);
    if (a.data === "esta_y_siguientes")
      borrar = borrar.gte("fecha", cita.fecha);
  }
  const { error } = await borrar;
  return error ? ERROR_BASE : { ok: true };
}

/** Crea (con repetición) o edita un bloqueo. */
export async function guardarBloqueo(
  datos: unknown,
): Promise<ResultadoSimple & { campo?: string }> {
  const miembro = await miembroQuePuede("bloquear_horario");
  if (!miembro) return SIN_PERMISO;
  const p = esquemaBloqueo.safeParse(datos);
  if (!p.success) return errorDeZod(p.error.issues);
  const d = p.data;
  const inicio = `${d.fechaInicio}T${d.horaInicio}:00`;
  const fin = `${d.fechaFin}T${d.horaFin}:00`;
  const supabase = await crearClienteServidor();
  if (d.id) {
    const { error } = await supabase
      .from("bloqueos")
      .update({
        profesional_id: d.profesionalId,
        motivo: d.motivo,
        inicio,
        fin,
      })
      .eq("id", d.id);
    return error ? ERROR_BASE : { ok: true };
  }
  const tramos = tramosBloqueo(inicio, fin, d.repetir);
  const serie = tramos.length > 1 ? crypto.randomUUID() : null;
  const { error } = await supabase.from("bloqueos").insert(
    tramos.map((t) => ({
      negocio_id: miembro.negocioId,
      profesional_id: d.profesionalId,
      motivo: d.motivo,
      inicio: t.inicio,
      fin: t.fin,
      serie_id: serie,
    })),
  );
  return error ? ERROR_BASE : { ok: true };
}

/** Borra un bloqueo; si es de una serie, también puede borrar los siguientes. */
export async function borrarBloqueo(
  bloqueoId: unknown,
  alcance: unknown,
): Promise<ResultadoSimple> {
  if (!(await miembroQuePuede("bloquear_horario"))) return SIN_PERMISO;
  const b = id.safeParse(bloqueoId);
  const a = esquemaAlcance.safeParse(alcance);
  if (!b.success || !a.success)
    return { ok: false, error: "Revisa el bloqueo" };
  const supabase = await crearClienteServidor();
  const { data: bloqueo } = await supabase
    .from("bloqueos")
    .select("id, serie_id, inicio")
    .eq("id", b.data)
    .maybeSingle();
  if (!bloqueo) return { ok: false, error: "El bloqueo ya no existe" };
  let borrar = supabase.from("bloqueos").delete();
  borrar =
    bloqueo.serie_id && a.data === "esta_y_siguientes"
      ? borrar.eq("serie_id", bloqueo.serie_id).gte("inicio", bloqueo.inicio)
      : borrar.eq("id", bloqueo.id);
  const { error } = await borrar;
  return error ? ERROR_BASE : { ok: true };
}

export interface HoraLibre {
  fecha: string;
  hora: string;
  profesionalId: string;
  profesional: string;
}

const esquemaBusqueda = z.object({
  localId: id,
  servicioId: id,
  profesionalId: id.nullable(),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Búsqueda rápida de hora: las 6 primeras horas libres desde `desde` para un servicio (y profesional, si se elige). */
export async function buscarHorasLibres(
  datos: unknown,
): Promise<
  | { ok: true; horas: HoraLibre[]; aviso: string | null }
  | { ok: false; error: string }
> {
  if (!(await miembroQuePuede("crear_cita"))) return SIN_PERMISO;
  const p = esquemaBusqueda.safeParse(datos);
  if (!p.success) return errorDeZod(p.error.issues);
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("buscar_horas_libres", {
    p_local: p.data.localId,
    p_servicio: p.data.servicioId,
    p_desde: p.data.desde,
    ...(p.data.profesionalId ? { p_profesional: p.data.profesionalId } : {}),
    p_cantidad: 6,
  });
  if (error || !data) return { ok: false, error: "No se pudo buscar. Intenta de nuevo." };
  const r = data as unknown as {
    ok: boolean;
    horas?: HoraLibre[];
    aviso?: string;
    error?: { message: string };
  };
  if (!r.ok) return { ok: false, error: r.error?.message ?? "No se pudo buscar" };
  return { ok: true, horas: r.horas ?? [], aviso: r.aviso ?? null };
}
