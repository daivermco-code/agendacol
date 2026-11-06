import "server-only";
import { hoyEnBogota } from "@/features/ventas/services/panel";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import { estadoBono } from "../lib/bonos";
import type { Bono, Plan, TipoBono } from "../types";

/** Planes del catálogo con cuántos se han vendido. */
export async function listarPlanes(): Promise<Plan[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("planes")
    .select(
      "id, nombre, descripcion, precio, vigencia_dias, sesiones, servicios, activo, bonos(count)",
    )
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    precio: p.precio,
    vigenciaDias: p.vigencia_dias,
    sesiones: p.sesiones,
    servicios: p.servicios,
    activo: p.activo,
    vendidos: p.bonos[0]?.count ?? 0,
  }));
}

/** Servicios que pueden ir en un plan (todos menos los paquetes), para elegir en el formulario. */
export async function serviciosParaPlan(): Promise<
  { id: string; nombre: string; categoria: string }[]
> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("servicios")
    .select("id, nombre, categorias(nombre, orden)")
    .eq("activo", true)
    .neq("tipo", "paquete")
    .order("orden")
    .order("nombre");
  return (data ?? []).map((s) => ({
    id: s.id,
    nombre: s.nombre,
    categoria: s.categorias?.nombre ?? "",
  }));
}

/** Planes, sesiones y paquetes vendidos (de un cliente, si se pide), con su estado a hoy. */
export async function listarBonos(clienteId?: string): Promise<Bono[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc(
    "listar_bonos",
    clienteId ? { p_cliente: clienteId } : {},
  );
  if (error) throw new Error(error.message);
  const hoy = hoyEnBogota();
  return (data ?? []).map((b) => ({
    id: b.id,
    tipo: b.tipo as TipoBono,
    nombre: b.nombre,
    clienteId: b.cliente_id,
    cliente: b.cliente,
    servicios: b.servicios,
    cupo: b.cupo,
    usadas: b.usadas,
    inicio: b.inicio,
    vence: b.vence,
    venta: b.venta,
    estado: estadoBono(b, hoy),
  }));
}
