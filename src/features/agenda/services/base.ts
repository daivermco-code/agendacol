import "server-only";
import { aDias } from "@/features/administracion/services/catalogo";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import type { BaseAgenda } from "../types";

interface FilaServicio {
  id: string;
  nombre: string;
  duracion_min: number;
  precio: number;
  categorias: { nombre: string } | null;
  servicio_profesional: { profesional_id: string }[];
  recursos: string[];
}

const aServicio = (s: FilaServicio) => ({
  id: s.id,
  nombre: s.nombre,
  categoria: s.categorias?.nombre ?? "",
  duracionMin: s.duracion_min,
  precio: s.precio,
  profesionales: s.servicio_profesional.map((x) => x.profesional_id),
  recursos: s.recursos,
});

/** Locales, horarios, profesionales, servicios y ajustes que la agenda usa en todas las vistas. */
export async function obtenerBaseAgenda(
  negocioId: string,
): Promise<BaseAgenda> {
  const supabase = await crearClienteServidor();
  const [
    { data: locales },
    { data: profesionales },
    { data: ajustes },
    { data: negocio },
    { data: servicios },
    { data: recursos },
  ] = await Promise.all([
    supabase
      .from("locales")
      .select("id, nombre, zona_horaria, activo, horarios_local(*)")
      .eq("activo", true)
      .order("created_at"),
    supabase
      .from("profesionales")
      .select(
        "id, nombre, color, foto_url, local_id, activo, horarios_profesional(*)",
      )
      .order("orden")
      .order("nombre"),
    supabase
      .from("ajustes")
      .select("bloque_min, exigir_contacto, aviso_correo, aviso_whatsapp")
      .maybeSingle(),
    supabase.from("negocios").select("slug").maybeSingle(),
    supabase
      .from("servicios")
      .select(
        "id, nombre, duracion_min, precio, tipo, cupo, recursos, categorias(nombre), servicio_profesional(profesional_id)",
      )
      .eq("activo", true)
      .order("orden")
      .order("nombre"),
    supabase
      .from("recursos")
      .select("id, nombre, local_id")
      .eq("activo", true)
      .order("orden")
      .order("nombre"),
  ]);

  return {
    negocioId,
    slug: negocio?.slug ?? "",
    bloqueMin: ajustes?.bloque_min ?? 60,
    locales: (locales ?? []).map((l) => ({
      id: l.id,
      nombre: l.nombre,
      zona: l.zona_horaria,
      horario: aDias(l.horarios_local, (f) => f.abierto),
    })),
    profesionales: (profesionales ?? []).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      color: p.color ?? "#0E7490",
      fotoUrl: p.foto_url,
      localId: p.local_id,
      activo: p.activo,
      horario: aDias(p.horarios_profesional, (f) => f.trabaja),
    })),
    servicios: (servicios ?? [])
      .filter((s) => s.tipo === "servicio" || s.tipo === "sesiones")
      .map(aServicio),
    clases: (servicios ?? [])
      .filter((s) => s.tipo === "clase")
      .map((s) => ({ ...aServicio(s), cupo: s.cupo ?? 2 })),
    recursos: (recursos ?? []).map((r) => ({
      id: r.id,
      nombre: r.nombre,
      localId: r.local_id,
    })),
    ajustes: {
      exigirContacto: ajustes?.exigir_contacto ?? false,
      avisoCorreo: ajustes?.aviso_correo ?? true,
      avisoWhatsapp: ajustes?.aviso_whatsapp ?? true,
    },
  };
}
