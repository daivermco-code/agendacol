"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { dentroDelLimite } from "@/features/reserva-publica/lib/limite";
import { claveVisitante } from "@/features/reserva-publica/lib/visitante";
import type { RespuestaPublica } from "@/features/reserva-publica/types";
import { crearClientePublico } from "@/shared/lib/supabase/publico";
import { COOKIE_ACCESO, leerAcceso } from "./lib/acceso";
import { esquemaEntrar, esquemaPedirCodigo } from "./schemas";

/** "Mis citas" sin contraseña: pedir el código, entrar con él, salir y quitarse de una lista de espera. */
type Falla = { ok: false; error: string; campo?: string };
type Hecho<T = undefined> = T extends undefined
  ? { ok: true }
  : { ok: true; datos: T };

const ERROR_BASE: Falla = {
  ok: false,
  error: "No pudimos hacerlo. Intenta de nuevo en un momento.",
};

function primeraFalla(
  issues: ReadonlyArray<{ message: string; path: PropertyKey[] }>,
): Falla {
  const i = issues[0];
  return {
    ok: false,
    error: i?.message ?? "Revisa los datos",
    campo: typeof i?.path[0] === "string" ? i.path[0] : undefined,
  };
}

function deRespuesta(data: unknown): Falla | null {
  const r = data as RespuestaPublica | null;
  if (!r) return ERROR_BASE;
  return r.ok
    ? null
    : { ok: false, error: r.error.message, campo: r.error.field };
}

export async function pedirCodigo(
  entrada: unknown,
): Promise<Hecho<{ destino: string; canal: "correo" | "whatsapp" }> | Falla> {
  const p = esquemaPedirCodigo.safeParse(entrada);
  if (!p.success) return primeraFalla(p.error.issues);
  if (!dentroDelLimite(`codigo:${await claveVisitante()}`))
    return {
      ok: false,
      error: "Pediste muchos códigos seguidos. Espera un minuto.",
      campo: "dato",
    };
  const { data, error } = await crearClientePublico().rpc(
    "publico_pedir_codigo",
    { p_slug: p.data.slug, p_dato: p.data.dato },
  );
  if (error) return ERROR_BASE;
  const malo = deRespuesta(data);
  if (malo) return malo;
  const r = data as { destino: string; canal: "correo" | "whatsapp" };
  return { ok: true, datos: { destino: r.destino, canal: r.canal } };
}

export async function entrarConCodigo(
  entrada: unknown,
): Promise<Hecho | Falla> {
  const p = esquemaEntrar.safeParse(entrada);
  if (!p.success) return primeraFalla(p.error.issues);
  if (!dentroDelLimite(`entrar:${await claveVisitante()}`))
    return {
      ok: false,
      error: "Muchos intentos seguidos. Espera un minuto.",
      campo: "codigo",
    };
  const { data, error } = await crearClientePublico().rpc(
    "publico_entrar_codigo",
    { p_slug: p.data.slug, p_dato: p.data.dato, p_codigo: p.data.codigo },
  );
  if (error) return ERROR_BASE;
  const malo = deRespuesta(data);
  if (malo) return malo;
  (await cookies()).set(COOKIE_ACCESO, (data as { token: string }).token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return { ok: true };
}

export async function salirDeMisCitas(): Promise<Hecho> {
  const token = await leerAcceso();
  if (token)
    await crearClientePublico().rpc("publico_salir", { p_token: token });
  (await cookies()).delete(COOKIE_ACCESO);
  return { ok: true };
}

export async function quitarEspera(id: unknown): Promise<Hecho | Falla> {
  const p = z.string().uuid().safeParse(id);
  if (!p.success) return ERROR_BASE;
  const token = await leerAcceso();
  if (!token)
    return {
      ok: false,
      error: "Tu acceso venció. Entra de nuevo con un código.",
    };
  const { data, error } = await crearClientePublico().rpc(
    "publico_quitar_espera",
    { p_token: token, p_id: p.data },
  );
  return error ? ERROR_BASE : (deRespuesta(data) ?? { ok: true });
}
