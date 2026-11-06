"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  miembroQuePuede,
  primerError,
  SIN_PERMISO,
  type ResultadoAccion,
} from "@/shared/lib/acciones";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import { esquemaExistencias, esquemaProducto } from "./schemas";
import type { MovimientoStock, TipoMovimientoStock } from "./types";

const ERROR_BASE = {
  ok: false,
  error: "No se pudo guardar. Intenta de nuevo.",
  code: "BASE",
} as const;

interface RespuestaBase {
  ok: boolean;
  existencias?: number;
  cambio?: number;
  error?: { code: string; message: string };
}

function refrescar() {
  revalidatePath("/administracion/productos");
  revalidatePath("/");
}

/** Mueve existencias por la función de la base (deja el movimiento; solo el dueño). */
async function mover(
  productoId: string,
  tipo: "entrada" | "conteo",
  cantidad: number,
  nota: string,
): Promise<RespuestaBase | null> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("mover_existencias", {
    p_producto: productoId,
    p_tipo: tipo,
    p_cantidad: cantidad,
    p_nota: nota,
  });
  return error || !data ? null : (data as unknown as RespuestaBase);
}

export async function guardarProducto(entrada: unknown): Promise<ResultadoAccion<{ id: string }>> {
  const miembro = await miembroQuePuede("administrar");
  if (!miembro) return SIN_PERMISO;
  const p = esquemaProducto.safeParse(entrada);
  if (!p.success) return primerError(p.error.issues);
  const d = p.data;
  const supabase = await crearClienteServidor();
  const campos = {
    nombre: d.nombre,
    categoria: d.categoria || null,
    precio: d.precio,
    stock_minimo: d.stockMinimo,
    activo: d.activo,
  };
  const { data, error } = d.id
    ? await supabase.from("productos").update(campos).eq("id", d.id).select("id").single()
    : await supabase
        .from("productos")
        .insert({ ...campos, negocio_id: miembro.negocioId })
        .select("id")
        .single();
  if (error?.code === "23505")
    return {
      ok: false,
      error: "Ya hay un producto con ese nombre",
      code: "VALIDACION",
    };
  if (error || !data) return ERROR_BASE;
  if (!d.id && d.existenciasIniciales > 0) {
    const r = await mover(data.id, "entrada", d.existenciasIniciales, "Existencias iniciales");
    if (!r?.ok)
      return {
        ok: false,
        error: "El producto se creó, pero sin existencias. Agrégalas con «Mover existencias».",
        code: "BASE",
      };
  }
  refrescar();
  return { ok: true, datos: { id: data.id } };
}

export async function moverExistencias(
  entrada: unknown,
): Promise<ResultadoAccion<{ existencias: number; cambio: number }>> {
  if (!(await miembroQuePuede("administrar"))) return SIN_PERMISO;
  const p = esquemaExistencias.safeParse(entrada);
  if (!p.success) return primerError(p.error.issues);
  const d = p.data;
  const r = await mover(d.productoId, d.tipo, d.cantidad, d.nota);
  if (!r) return ERROR_BASE;
  if (!r.ok)
    return {
      ok: false,
      error: r.error?.message ?? ERROR_BASE.error,
      code: "VALIDACION",
    };
  refrescar();
  return {
    ok: true,
    datos: { existencias: r.existencias ?? 0, cambio: r.cambio ?? 0 },
  };
}

export async function borrarProducto(id: unknown): Promise<ResultadoAccion> {
  if (!(await miembroQuePuede("administrar"))) return SIN_PERMISO;
  const p = z.string().uuid().safeParse(id);
  if (!p.success) return primerError(p.error.issues);
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("productos").delete().eq("id", p.data);
  if (error?.code === "23503")
    return {
      ok: false,
      error: "Ya tiene ventas: no se puede borrar. Desactívalo para que no salga a la venta.",
      code: "VALIDACION",
    };
  if (error) return ERROR_BASE;
  refrescar();
  return { ok: true };
}

/** Los últimos 50 movimientos de un producto, del más nuevo al más viejo. */
export async function historialProducto(id: unknown): Promise<ResultadoAccion<MovimientoStock[]>> {
  if (!(await miembroQuePuede("administrar"))) return SIN_PERMISO;
  const p = z.string().uuid().safeParse(id);
  if (!p.success) return primerError(p.error.issues);
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("movimientos_stock")
    .select("id, created_at, tipo, cantidad, nota, miembros(nombre)")
    .eq("producto_id", p.data)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return ERROR_BASE;
  return {
    ok: true,
    datos: (data ?? []).map((m) => ({
      id: m.id,
      fecha: m.created_at,
      tipo: m.tipo as TipoMovimientoStock,
      cantidad: m.cantidad,
      nota: m.nota,
      quien: m.miembros?.nombre ?? null,
    })),
  };
}
