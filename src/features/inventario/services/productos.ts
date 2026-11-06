import "server-only";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import type { Producto } from "../types";

/** Todos los productos del negocio (activos e inactivos), por nombre. */
export async function listarProductos(): Promise<Producto[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("productos")
    .select("id, nombre, categoria, precio, existencias, stock_minimo, activo")
    .order("nombre")
    .limit(500);
  return (data ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    categoria: p.categoria,
    precio: p.precio,
    existencias: p.existencias,
    stockMinimo: p.stock_minimo,
    activo: p.activo,
  }));
}
