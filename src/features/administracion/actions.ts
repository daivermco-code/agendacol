"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  miembroQuePuede,
  primerError,
  SIN_PERMISO,
} from "@/shared/lib/acciones";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import type { Database } from "@/types/database";
import {
  esquemaCategoria,
  esquemaHorario,
  esquemaLocal,
  esquemaOrden,
  esquemaProfesional,
  esquemaServicio,
  type DiaHorario,
} from "./schemas";

type Resultado =
  | { ok: true; id?: string; aviso?: string }
  | { ok: false; error: string; code?: string };

const ERROR_BASE = {
  ok: false,
  error: "No se pudo guardar. Intenta de nuevo.",
  code: "BASE",
} as const;

function filaHorario(d: DiaHorario) {
  return {
    dia_semana: d.dia,
    inicio: d.activo && d.inicio ? d.inicio : null,
    fin: d.activo && d.fin ? d.fin : null,
    descanso_inicio:
      d.activo && d.descanso && d.descansoInicio ? d.descansoInicio : null,
    descanso_fin:
      d.activo && d.descanso && d.descansoFin ? d.descansoFin : null,
  };
}

function refrescar() {
  revalidatePath("/administracion", "layout");
  revalidatePath("/", "layout");
}

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

/** Local nuevo con el horario del primero (o de lunes a sábado de 9 a 7 si no hay otro). */
async function crearLocal(
  supabase: Cliente,
  negocioId: string,
  campos: Omit<Database["public"]["Tables"]["locales"]["Insert"], "negocio_id">,
): Promise<boolean> {
  const { data: primero } = await supabase
    .from("locales")
    .select("horarios_local(*)")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  const { data: nuevo, error } = await supabase
    .from("locales")
    .insert({ ...campos, negocio_id: negocioId })
    .select("id")
    .single();
  if (error || !nuevo) return false;
  const base = primero?.horarios_local ?? [];
  const filas = Array.from({ length: 7 }, (_, i) => {
    const dia = base.find((h) => h.dia_semana === i + 1);
    return dia
      ? { ...dia, local_id: nuevo.id }
      : {
          local_id: nuevo.id,
          dia_semana: i + 1,
          abierto: i < 6,
          inicio: i < 6 ? "09:00" : null,
          fin: i < 6 ? "19:00" : null,
        };
  });
  const { error: errorHorario } = await supabase
    .from("horarios_local")
    .insert(filas);
  return !errorHorario;
}

export async function guardarLocal(entrada: unknown): Promise<Resultado> {
  const miembro = await miembroQuePuede("administrar");
  if (!miembro) return SIN_PERMISO;
  const p = esquemaLocal.safeParse(entrada);
  if (!p.success) return primerError(p.error.issues);
  const d = p.data;

  const supabase = await crearClienteServidor();
  const campos = {
    nombre: d.nombre,
    direccion: d.direccion || null,
    telefono: d.telefono || null,
    acepta_whatsapp: d.aceptaWhatsapp,
    correo: d.correo || null,
    zona_horaria: d.zonaHoraria,
    reservas_en_linea: d.reservasEnLinea,
  };
  if (d.id) {
    const { error } = await supabase
      .from("locales")
      .update(campos)
      .eq("id", d.id);
    if (error) return ERROR_BASE;
  } else if (!(await crearLocal(supabase, miembro.negocioId, campos)))
    return ERROR_BASE;
  await supabase
    .from("negocios")
    .update({ descripcion: d.descripcion || null })
    .eq("id", miembro.negocioId);
  refrescar();
  return { ok: true };
}

export async function guardarHorarioLocal(
  localId: unknown,
  dias: unknown,
): Promise<Resultado> {
  if (!(await miembroQuePuede("administrar"))) return SIN_PERMISO;
  const id = z.string().uuid().safeParse(localId);
  const p = esquemaHorario.safeParse(dias);
  if (!id.success) return { ok: false, error: "Local no válido" };
  if (!p.success) return primerError(p.error.issues);

  const supabase = await crearClienteServidor();
  const filas = p.data.map((d) => ({
    ...filaHorario(d),
    local_id: id.data,
    abierto: d.activo,
  }));
  const { error } = await supabase
    .from("horarios_local")
    .upsert(filas, { onConflict: "local_id,dia_semana" });
  if (error) return ERROR_BASE;
  refrescar();
  return { ok: true };
}

export async function guardarCategoria(entrada: unknown): Promise<Resultado> {
  const miembro = await miembroQuePuede("administrar");
  if (!miembro) return SIN_PERMISO;
  const p = esquemaCategoria.safeParse(entrada);
  if (!p.success) return primerError(p.error.issues);

  const supabase = await crearClienteServidor();
  const consulta = p.data.id
    ? supabase
        .from("categorias")
        .update({ nombre: p.data.nombre })
        .eq("id", p.data.id)
        .select("id")
        .single()
    : supabase
        .from("categorias")
        .insert({
          negocio_id: miembro.negocioId,
          nombre: p.data.nombre,
          orden: 99,
        })
        .select("id")
        .single();
  const { data, error } = await consulta;
  if (error?.code === "23505")
    return { ok: false, error: "Ya hay una categoría con ese nombre" };
  if (error || !data) return ERROR_BASE;
  refrescar();
  return { ok: true, id: data.id };
}

export async function borrarCategoria(id: unknown): Promise<Resultado> {
  if (!(await miembroQuePuede("administrar"))) return SIN_PERMISO;
  const p = z.string().uuid().safeParse(id);
  if (!p.success) return { ok: false, error: "Categoría no válida" };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("categorias").delete().eq("id", p.data);
  if (error?.code === "23503")
    return {
      ok: false,
      error: "La categoría tiene servicios: muévelos o bórralos primero",
    };
  if (error) return ERROR_BASE;
  refrescar();
  return { ok: true };
}

export async function guardarServicio(entrada: unknown): Promise<Resultado> {
  const miembro = await miembroQuePuede("administrar");
  if (!miembro) return SIN_PERMISO;
  const p = esquemaServicio.safeParse(entrada);
  if (!p.success) return primerError(p.error.issues);
  const d = p.data;

  const supabase = await crearClienteServidor();
  // Las clases y los paquetes no se reservan en línea (se agendan desde la agenda o se venden en la caja).
  const fila = {
    nombre: d.nombre,
    categoria_id: d.categoriaId,
    precio: d.precio,
    duracion_min: d.duracionMin,
    sesiones: d.tipo === "sesiones" ? d.sesiones : null,
    vigencia_dias:
      d.tipo === "sesiones" || d.tipo === "paquete"
        ? (d.vigenciaDias ?? 180)
        : null,
    cupo: d.tipo === "clase" ? d.cupo : null,
    incluye: d.tipo === "paquete" ? d.incluye : [],
    descripcion: d.descripcion || null,
    en_linea: d.enLinea && d.tipo !== "clase" && d.tipo !== "paquete",
    mostrar_precio: d.mostrarPrecio,
    mostrar_duracion: d.mostrarDuracion,
    imagenes: d.imagenes,
    activo: d.activo,
  };
  const { data, error } = d.id
    ? await supabase
        .from("servicios")
        .update(fila)
        .eq("id", d.id)
        .select("id")
        .single()
    : await supabase
        .from("servicios")
        .insert({
          ...fila,
          tipo: d.tipo,
          negocio_id: miembro.negocioId,
          orden: 999,
        })
        .select("id")
        .single();
  if (error || !data) return ERROR_BASE;

  await supabase
    .from("servicio_profesional")
    .delete()
    .eq("servicio_id", data.id);
  if (d.profesionales.length > 0) {
    const { error: e2 } = await supabase.from("servicio_profesional").insert(
      d.profesionales.map((profesional_id) => ({
        servicio_id: data.id,
        profesional_id,
      })),
    );
    if (e2) return ERROR_BASE;
  }
  refrescar();
  return { ok: true, id: data.id };
}

/** Borra el servicio; si ya tiene citas o ventas (llave foránea), lo desactiva. */
export async function borrarServicio(id: unknown): Promise<Resultado> {
  if (!(await miembroQuePuede("administrar"))) return SIN_PERMISO;
  const p = z.string().uuid().safeParse(id);
  if (!p.success) return { ok: false, error: "Servicio no válido" };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("servicios").delete().eq("id", p.data);
  if (error?.code === "23503") {
    await supabase.from("servicios").update({ activo: false }).eq("id", p.data);
    refrescar();
    return { ok: true, aviso: "Tiene citas: se desactivó en vez de borrarse" };
  }
  if (error) return ERROR_BASE;
  refrescar();
  return { ok: true };
}

export async function ordenarServicios(ids: unknown): Promise<Resultado> {
  if (!(await miembroQuePuede("administrar"))) return SIN_PERMISO;
  const p = esquemaOrden.safeParse(ids);
  if (!p.success) return { ok: false, error: "Orden no válido" };
  const supabase = await crearClienteServidor();
  const resultados = await Promise.all(
    p.data.map((id, orden) =>
      supabase.from("servicios").update({ orden }).eq("id", id),
    ),
  );
  if (resultados.some((r) => r.error)) return ERROR_BASE;
  refrescar();
  return { ok: true };
}

export async function guardarProfesional(entrada: unknown): Promise<Resultado> {
  const miembro = await miembroQuePuede("administrar");
  if (!miembro) return SIN_PERMISO;
  const p = esquemaProfesional.safeParse(entrada);
  if (!p.success) return primerError(p.error.issues);
  const d = p.data;

  const supabase = await crearClienteServidor();
  const fila = {
    nombre: d.nombre,
    color: d.color,
    local_id: d.localId,
    activo: d.activo,
  };
  const { data, error } = d.id
    ? await supabase
        .from("profesionales")
        .update(fila)
        .eq("id", d.id)
        .select("id")
        .single()
    : await supabase
        .from("profesionales")
        .insert({ ...fila, negocio_id: miembro.negocioId, orden: 99 })
        .select("id")
        .single();
  if (error || !data) return ERROR_BASE;

  const horario = d.horario.map((dia) => ({
    ...filaHorario(dia),
    profesional_id: data.id,
    trabaja: dia.activo,
  }));
  const { error: e1 } = await supabase
    .from("horarios_profesional")
    .upsert(horario, { onConflict: "profesional_id,dia_semana" });
  await supabase
    .from("servicio_profesional")
    .delete()
    .eq("profesional_id", data.id);
  const { error: e2 } =
    d.servicios.length > 0
      ? await supabase.from("servicio_profesional").insert(
          d.servicios.map((servicio_id) => ({
            servicio_id,
            profesional_id: data.id,
          })),
        )
      : { error: null };
  if (e1 || e2) return ERROR_BASE;
  refrescar();
  return { ok: true, id: data.id };
}
