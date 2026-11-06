import "server-only";
import { cache } from "react";
import { crearClientePublico } from "@/shared/lib/supabase/publico";
import type { CitaPublica, DiaLibre, Portada } from "../types";

const SLUG = /^[a-z0-9-]{3,40}$/;
const TOKEN = /^[0-9a-f]{32}$/;

/** Portada del negocio (una vez por petición aunque la pidan el layout y la página). */
export const obtenerPortada = cache(
  async (slug: string): Promise<Portada | null> => {
    if (!SLUG.test(slug)) return null;
    const { data, error } = await crearClientePublico().rpc("publico_negocio", {
      p_slug: slug,
    });
    if (error) throw new Error("No se pudo cargar el negocio");
    return data as unknown as Portada | null;
  },
);

/** Días con horas libres para esos servicios (ids repetidos según la cantidad). null = la reserva no vale. */
export async function obtenerDias(
  slug: string,
  servicios: string[],
  profesionalId: string | null,
  desde: string,
  dias = 7,
): Promise<DiaLibre[] | null> {
  const { data, error } = await crearClientePublico().rpc(
    "publico_disponibilidad",
    {
      p_slug: slug,
      p_servicios: servicios,
      p_profesional: profesionalId as string,
      p_desde: desde,
      p_dias: dias,
    },
  );
  if (error) throw new Error("No se pudieron cargar las horas");
  return data as unknown as DiaLibre[] | null;
}

export const obtenerCita = cache(
  async (token: string): Promise<CitaPublica | null> => {
    if (!TOKEN.test(token)) return null;
    const { data, error } = await crearClientePublico().rpc("publico_cita", {
      p_token: token,
    });
    if (error) throw new Error("No se pudo cargar la cita");
    return data as unknown as CitaPublica | null;
  },
);

/** Horas para cambiar la cita: mismo profesional y misma duración. */
export async function obtenerHorasCita(
  token: string,
  desde: string,
  dias = 7,
): Promise<DiaLibre[] | null> {
  if (!TOKEN.test(token)) return null;
  const { data, error } = await crearClientePublico().rpc(
    "publico_horas_cita",
    {
      p_token: token,
      p_desde: desde,
      p_dias: dias,
    },
  );
  if (error) throw new Error("No se pudieron cargar las horas");
  return data as unknown as DiaLibre[] | null;
}
