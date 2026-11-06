import "server-only";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import type { FilaEspera } from "../types";

/** Toda la lista de espera del negocio (RLS: dueño y recepción), por día. */
export async function listarEspera(): Promise<FilaEspera[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("lista_espera_equipo");
  if (error) throw new Error(error.message);
  return (data ?? []).map((f) => ({
    id: f.id,
    fecha: f.fecha,
    franja: f.franja as FilaEspera["franja"],
    estado: f.estado as FilaEspera["estado"],
    avisadoAt: f.avisado_at,
    creadaAt: f.created_at,
    clienteId: f.cliente_id,
    cliente: f.cliente,
    telefono: f.telefono,
    servicios: f.servicios ?? "",
    profesional: f.profesional,
  }));
}
