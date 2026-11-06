"use server";

import { z } from "zod";
import { crearClientePublico } from "@/shared/lib/supabase/publico";
import { dentroDelLimite } from "./lib/limite";
import { claveVisitante } from "./lib/visitante";
import {
  esquemaBuscarDias,
  esquemaCalificacion,
  esquemaEspera,
  esquemaFecha,
  esquemaHora,
  esquemaReserva,
  esquemaToken,
} from "./schemas";
import { obtenerDias, obtenerHorasCita } from "./services/publico";
import type { DiaLibre, RespuestaPublica } from "./types";

/** Acciones del sitio de reservas y del enlace del cliente: sin sesión, validadas con Zod y por la base. */
type Falla = { ok: false; error: string; code?: string; campo?: string };
type Hecho<T = undefined> = T extends undefined
  ? { ok: true }
  : { ok: true; datos: T };

const ERROR_BASE: Falla = {
  ok: false,
  error: "No pudimos hacerlo. Intenta de nuevo en un momento.",
  code: "BASE",
};

function falla(
  issues: ReadonlyArray<{ message: string; path: PropertyKey[] }>,
): Falla {
  const primero = issues[0];
  return {
    ok: false,
    error: primero?.message ?? "Revisa los datos",
    code: "VALIDACION",
    campo: typeof primero?.path[0] === "string" ? primero.path[0] : undefined,
  };
}

/** Lo que devolvió una función publico_* que cambia algo. */
function deRespuesta(data: unknown): Falla | null {
  const r = data as RespuestaPublica | null;
  if (!r) return ERROR_BASE;
  return r.ok
    ? null
    : {
        ok: false,
        error: r.error.message,
        code: r.error.code,
        campo: r.error.field,
      };
}

export async function buscarDias(
  entrada: unknown,
): Promise<Hecho<DiaLibre[]> | Falla> {
  const p = esquemaBuscarDias.safeParse(entrada);
  if (!p.success) return falla(p.error.issues);
  try {
    const dias = await obtenerDias(
      p.data.slug,
      p.data.servicios,
      p.data.profesionalId,
      p.data.desde,
    );
    return dias
      ? { ok: true, datos: dias }
      : {
          ok: false,
          error: "Esos servicios ya no se pueden reservar en línea",
        };
  } catch {
    return ERROR_BASE;
  }
}

export async function reservar(
  entrada: unknown,
): Promise<Hecho<{ token: string }> | Falla> {
  const p = esquemaReserva.safeParse(entrada);
  if (!p.success) return falla(p.error.issues);
  if (!dentroDelLimite(await claveVisitante())) {
    return {
      ok: false,
      error:
        "Hiciste muchas reservas seguidas. Espera un minuto e intenta de nuevo.",
      code: "LIMITE",
    };
  }
  const d = p.data;
  const { data, error } = await crearClientePublico().rpc("publico_reservar", {
    p: {
      slug: d.slug,
      servicios: d.servicios,
      profesionalId: d.profesionalId ?? "",
      fecha: d.fecha,
      hora: d.hora,
      nombre: d.nombre,
      apellido: d.apellido,
      correo: d.correo,
      telefono: d.telefono,
      nota: d.nota,
      autoriza: d.autoriza,
    },
  });
  if (error) return ERROR_BASE;
  const malo = deRespuesta(data);
  if (malo) return malo;
  return { ok: true, datos: { token: (data as { token: string }).token } };
}

export async function confirmarCita(token: unknown): Promise<Hecho | Falla> {
  const t = esquemaToken.safeParse(token);
  if (!t.success) return falla(t.error.issues);
  const { data, error } = await crearClientePublico().rpc(
    "publico_confirmar_cita",
    { p_token: t.data },
  );
  return error ? ERROR_BASE : (deRespuesta(data) ?? { ok: true });
}

export async function cancelarCita(
  token: unknown,
  motivo: unknown,
): Promise<Hecho | Falla> {
  const p = z
    .object({
      token: esquemaToken,
      motivo: z.string().trim().max(150, "Máximo 150 letras"),
    })
    .safeParse({
      token,
      motivo,
    });
  if (!p.success) return falla(p.error.issues);
  const { data, error } = await crearClientePublico().rpc(
    "publico_cancelar_cita",
    {
      p_token: p.data.token,
      p_motivo: p.data.motivo,
    },
  );
  return error ? ERROR_BASE : (deRespuesta(data) ?? { ok: true });
}

export async function buscarHorasCita(
  token: unknown,
  desde: unknown,
): Promise<Hecho<DiaLibre[]> | Falla> {
  const p = z
    .object({ token: esquemaToken, desde: esquemaFecha })
    .safeParse({ token, desde });
  if (!p.success) return falla(p.error.issues);
  try {
    const dias = await obtenerHorasCita(p.data.token, p.data.desde);
    return dias
      ? { ok: true, datos: dias }
      : { ok: false, error: "Esta cita ya no se puede cambiar" };
  } catch {
    return ERROR_BASE;
  }
}

export async function cambiarCita(
  token: unknown,
  fecha: unknown,
  hora: unknown,
): Promise<Hecho | Falla> {
  const p = z
    .object({ token: esquemaToken, fecha: esquemaFecha, hora: esquemaHora })
    .safeParse({ token, fecha, hora });
  if (!p.success) return falla(p.error.issues);
  const { data, error } = await crearClientePublico().rpc(
    "publico_cambiar_cita",
    {
      p_token: p.data.token,
      p_fecha: p.data.fecha,
      p_hora: p.data.hora,
    },
  );
  return error ? ERROR_BASE : (deRespuesta(data) ?? { ok: true });
}

export async function calificarCita(entrada: unknown): Promise<Hecho | Falla> {
  const p = esquemaCalificacion.safeParse(entrada);
  if (!p.success) return falla(p.error.issues);
  const { data, error } = await crearClientePublico().rpc("publico_calificar", {
    p_token: p.data.token,
    p_estrellas: p.data.estrellas,
    p_comentario: p.data.comentario,
  });
  return error ? ERROR_BASE : (deRespuesta(data) ?? { ok: true });
}

/** "Avísame si se libera una hora": anota al cliente en la lista de espera de ese día. */
export async function anotarEnEspera(entrada: unknown): Promise<Hecho | Falla> {
  const p = esquemaEspera.safeParse(entrada);
  if (!p.success) return falla(p.error.issues);
  if (!dentroDelLimite(`espera:${await claveVisitante()}`)) {
    return {
      ok: false,
      error: "Hiciste muchas solicitudes seguidas. Espera un minuto.",
      code: "LIMITE",
    };
  }
  const d = p.data;
  const { data, error } = await crearClientePublico().rpc(
    "publico_lista_espera",
    {
      p: {
        slug: d.slug,
        servicios: d.servicios,
        profesionalId: d.profesionalId ?? "",
        fecha: d.fecha,
        franja: d.franja,
        nombre: d.nombre,
        apellido: d.apellido,
        correo: d.correo,
        telefono: d.telefono,
        autoriza: d.autoriza,
      },
    },
  );
  return error ? ERROR_BASE : (deRespuesta(data) ?? { ok: true });
}
