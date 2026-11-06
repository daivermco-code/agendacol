import "server-only";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import type { FiltroAudiencia } from "../lib/audiencias";
import type {
  Audiencia,
  Campana,
  ClienteSuprimido,
  Conteo,
  Cupo,
  ServicioFiltro,
} from "../types";

interface RespuestaConteo extends Conteo {
  usadosMes: number;
  cupoMes: number;
}

async function contar(filtro: FiltroAudiencia): Promise<RespuestaConteo> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("contar_audiencia", {
    p_filtro: { ...filtro },
  });
  if (error) throw new Error(error.message);
  return data as unknown as RespuestaConteo;
}

const aConteo = (r: RespuestaConteo): Conteo => ({
  total: r.total,
  reciben: r.reciben,
  sinCorreo: r.sinCorreo,
  suprimidos: r.suprimidos,
});

/** Cuántos recibirían un correo con este filtro (para la vista previa del formulario). */
export async function conteoDe(filtro: FiltroAudiencia): Promise<Conteo> {
  return aConteo(await contar(filtro));
}

/** Toda la base ("Todos los clientes") y el cupo de envíos del mes. */
export async function resumenCorreo(): Promise<{ todos: Conteo; cupo: Cupo }> {
  const r = await contar({});
  return { todos: aConteo(r), cupo: { usados: r.usadosMes, cupo: r.cupoMes } };
}

interface FilaAudiencia extends Conteo {
  id: string;
  nombre: string;
  filtro: FiltroAudiencia;
}

/** Las audiencias con sus cifras, en una sola llamada a la base. */
export async function listarAudiencias(): Promise<Audiencia[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("audiencias_con_conteo");
  if (error) throw new Error(error.message);
  return (data as unknown as FilaAudiencia[]).map((a) => ({
    id: a.id,
    nombre: a.nombre,
    filtro: a.filtro,
    conteo: {
      total: a.total,
      reciben: a.reciben,
      sinCorreo: a.sinCorreo,
      suprimidos: a.suprimidos,
    },
  }));
}

/** Borradores primero y luego las enviadas, la más nueva arriba. */
export async function listarCampanas(): Promise<Campana[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("campanas")
    .select(
      "id, audiencia_id, asunto, cuerpo, estado, destinatarios, enviada_at, created_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const filas = (data ?? []).map((c) => ({
    id: c.id,
    audienciaId: c.audiencia_id,
    asunto: c.asunto,
    cuerpo: c.cuerpo,
    estado: c.estado as Campana["estado"],
    destinatarios: c.destinatarios,
    enviadaAt: c.enviada_at,
    creada: c.created_at,
  }));
  return [
    ...filas.filter((c) => c.estado === "borrador"),
    ...filas.filter((c) => c.estado === "enviada"),
  ];
}

export async function listarSuprimidos(): Promise<ClienteSuprimido[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("clientes")
    .select("id, nombre, apellido, correo")
    .eq("recibe_campanas", false)
    .not("correo", "is", null)
    .order("apellido");
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({
    id: c.id,
    nombre: `${c.nombre} ${c.apellido}`,
    correo: c.correo ?? "",
  }));
}

/** Servicios activos para el filtro "han tomado". */
export async function serviciosParaFiltro(): Promise<ServicioFiltro[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("servicios")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");
  if (error) throw new Error(error.message);
  return data ?? [];
}
