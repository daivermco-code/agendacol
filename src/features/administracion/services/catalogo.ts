import "server-only";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import { hhmm } from "@/shared/lib/formato";
import type { DiaHorario, TipoServicio } from "../schemas";

interface FilaHorario {
  dia_semana: number;
  inicio: string | null;
  fin: string | null;
  descanso_inicio: string | null;
  descanso_fin: string | null;
}

/** Filas de la base → 7 días del formulario (los que faltan, cerrados). */
export function aDias<T extends FilaHorario>(
  filas: T[],
  activo: (f: T) => boolean,
): DiaHorario[] {
  return [1, 2, 3, 4, 5, 6, 7].map((dia) => {
    const f = filas.find((x) => x.dia_semana === dia);
    return {
      dia,
      activo: f ? activo(f) : false,
      inicio: hhmm(f?.inicio),
      fin: hhmm(f?.fin),
      descanso: Boolean(f?.descanso_inicio),
      descansoInicio: hhmm(f?.descanso_inicio),
      descansoFin: hhmm(f?.descanso_fin),
    };
  });
}

export async function obtenerLocales() {
  const supabase = await crearClienteServidor();
  const [{ data: locales }, { data: negocio }] = await Promise.all([
    supabase.from("locales").select("*, horarios_local(*)").order("created_at"),
    supabase.from("negocios").select("descripcion").maybeSingle(),
  ]);
  return (locales ?? []).map((l) => ({
    id: l.id,
    nombre: l.nombre,
    direccion: l.direccion ?? "",
    telefono: l.telefono ?? "",
    aceptaWhatsapp: l.acepta_whatsapp,
    correo: l.correo ?? "",
    zonaHoraria: l.zona_horaria,
    reservasEnLinea: l.reservas_en_linea,
    descripcion: negocio?.descripcion ?? "",
    horario: aDias(l.horarios_local, (f) => f.abierto),
  }));
}
export type LocalVista = Awaited<ReturnType<typeof obtenerLocales>>[number];

export async function obtenerCatalogo() {
  const supabase = await crearClienteServidor();
  const [{ data: categorias }, { data: servicios }, { data: profesionales }] =
    await Promise.all([
      supabase
        .from("categorias")
        .select("id, nombre, orden")
        .order("orden")
        .order("nombre"),
      supabase
        .from("servicios")
        .select("*, servicio_profesional(profesional_id)")
        .order("orden")
        .order("nombre"),
      supabase
        .from("profesionales")
        .select("id, nombre, color, activo")
        .order("orden")
        .order("nombre"),
    ]);
  return {
    categorias: categorias ?? [],
    servicios: (servicios ?? []).map((s) => ({
      id: s.id,
      nombre: s.nombre,
      categoriaId: s.categoria_id,
      precio: s.precio,
      duracionMin: s.duracion_min,
      tipo: s.tipo as TipoServicio,
      sesiones: s.sesiones,
      vigenciaDias: s.vigencia_dias,
      cupo: s.cupo,
      incluye: s.incluye,
      descripcion: s.descripcion ?? "",
      profesionales: s.servicio_profesional.map((x) => x.profesional_id),
      enLinea: s.en_linea,
      mostrarPrecio: s.mostrar_precio,
      mostrarDuracion: s.mostrar_duracion,
      imagenes: s.imagenes,
      activo: s.activo,
    })),
    profesionales: profesionales ?? [],
  };
}
export type Catalogo = Awaited<ReturnType<typeof obtenerCatalogo>>;
export type ServicioVista = Catalogo["servicios"][number];

export async function obtenerProfesionales() {
  const supabase = await crearClienteServidor();
  const [
    { data: profesionales },
    { data: locales },
    { data: servicios },
    { data: calificaciones },
  ] = await Promise.all([
    supabase
      .from("profesionales")
      .select("*, horarios_profesional(*), servicio_profesional(servicio_id)")
      .order("orden")
      .order("nombre"),
    supabase
      .from("locales")
      .select("id, nombre, horarios_local(*)")
      .order("created_at"),
    supabase.from("servicios").select("id, nombre, activo").order("nombre"),
    supabase.from("calificaciones").select("profesional_id, estrellas"),
  ]);
  const notas = new Map<string, { suma: number; cuantas: number }>();
  for (const c of calificaciones ?? []) {
    const n = notas.get(c.profesional_id) ?? { suma: 0, cuantas: 0 };
    notas.set(c.profesional_id, {
      suma: n.suma + c.estrellas,
      cuantas: n.cuantas + 1,
    });
  }
  return {
    profesionales: (profesionales ?? []).map((p) => {
      const n = notas.get(p.id);
      return {
        id: p.id,
        nombre: p.nombre,
        color: p.color ?? "#0E7490",
        localId: p.local_id,
        activo: p.activo,
        servicios: p.servicio_profesional.map((x) => x.servicio_id),
        horario: aDias(p.horarios_profesional, (f) => f.trabaja),
        /** Calificación privada de los clientes: promedio de 1 a 5 y cuántas hay. */
        calificacion: n
          ? { promedio: n.suma / n.cuantas, cuantas: n.cuantas }
          : null,
      };
    }),
    locales: (locales ?? []).map((l) => ({
      id: l.id,
      nombre: l.nombre,
      horario: aDias(l.horarios_local, (f) => f.abierto),
    })),
    servicios: (servicios ?? [])
      .filter((s) => s.activo)
      .map((s) => ({ id: s.id, nombre: s.nombre })),
  };
}
export type DatosEquipo = Awaited<ReturnType<typeof obtenerProfesionales>>;
