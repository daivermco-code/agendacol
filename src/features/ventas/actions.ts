"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  miembroQuePuede,
  primerError,
  SIN_PERMISO,
  type ResultadoAccion,
} from "@/shared/lib/acciones";
import type { Accion } from "@/shared/lib/permisos";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import type { Json } from "@/types/database";
import {
  esquemaAnular,
  esquemaCerrarVenta,
  esquemaMovimiento,
  esquemaNumeracion,
  esquemaPagarSaldo,
  esquemaRectificar,
} from "./schemas";
import { datosPanel } from "./services/panel";
import { leerDetalleVenta } from "./services/ventas";
import type {
  CobroHecho,
  DatosPanel,
  DetalleVenta,
  ResultadoCobro,
} from "./types";

/** Respuesta de las funciones de venta de la base (jsonb). */
interface Respuesta {
  ok: boolean;
  error?: { code: string; message: string; field?: string };
  [clave: string]: unknown;
}

const ERROR_BASE = {
  ok: false,
  error: "No se pudo guardar. Intenta de nuevo.",
  code: "BASE",
} as const;
const id = z.string().uuid();

function errorDeZod(issues: ReadonlyArray<z.core.$ZodIssue>) {
  const i = issues[0];
  return {
    ok: false as const,
    error: i?.message ?? "Revisa los datos",
    campo: String(i?.path[0] ?? ""),
  };
}

/** Llama una función de la base que responde {ok, error?}; revisa el permiso antes. */
async function llamar(
  accion: Accion,
  funcion: string,
  args: Record<string, unknown>,
): Promise<
  | { ok: true; r: Respuesta }
  | { ok: false; error: string; campo?: string; code?: string }
> {
  if (!(await miembroQuePuede(accion))) return SIN_PERMISO;
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc(
    funcion as "cerrar_venta",
    args as { p: Json },
  );
  if (error || !data) return ERROR_BASE;
  const r = data as unknown as Respuesta;
  if (!r.ok)
    return {
      ok: false,
      error: r.error?.message ?? ERROR_BASE.error,
      campo: r.error?.field,
      code: r.error?.code,
    };
  return { ok: true, r };
}

function aCobro(r: Respuesta): CobroHecho {
  return {
    ventaId: String(r.ventaId),
    numero: String(r.numero),
    vuelto: Number(r.vuelto ?? 0),
    estado: r.estado as CobroHecho["estado"],
    total: Number(r.total),
    pagado: Number(r.pagado),
    giftCards: Array.isArray(r.giftCards)
      ? (r.giftCards as CobroHecho["giftCards"])
      : [],
  };
}

/** Lo que el panel muestra al abrirse (citas como ítems, cliente, saldo de una venta y catálogo). */
export async function prepararVenta(
  pedido: unknown,
): Promise<ResultadoAccion<DatosPanel>> {
  if (!(await miembroQuePuede("cobrar"))) return SIN_PERMISO;
  const p = z
    .object({
      citaIds: z.array(id).max(30).catch([]),
      clienteId: id.nullable().catch(null),
      ventaId: id.nullable().catch(null),
    })
    .parse({
      citaIds: [],
      clienteId: null,
      ventaId: null,
      ...(pedido as object),
    });
  return datosPanel(p);
}

/** Cierra la venta: número correlativo, ítems, pagos y caja en una sola transacción (cerrar_venta). */
export async function cerrarVenta(datos: unknown): Promise<ResultadoCobro> {
  const p = esquemaCerrarVenta.safeParse(datos);
  if (!p.success) return errorDeZod(p.error.issues);
  const r = await llamar("cobrar", "cerrar_venta", { p: p.data });
  if (!r.ok) return r;
  revalidatePath("/", "layout");
  return { ok: true, cobro: aCobro(r.r) };
}

/** Paga el saldo de una venta en "Pago parcial" (completa la misma venta). */
export async function pagarSaldo(datos: unknown): Promise<ResultadoCobro> {
  const p = esquemaPagarSaldo.safeParse(datos);
  if (!p.success) return errorDeZod(p.error.issues);
  const r = await llamar("cobrar", "pagar_saldo", { p: p.data });
  if (!r.ok) return r;
  revalidatePath("/", "layout");
  return { ok: true, cobro: aCobro(r.r) };
}

/** Anula la venta con su motivo: revierte la caja y libera las citas (solo el dueño). */
export async function anularVenta(datos: unknown): Promise<ResultadoAccion> {
  const p = esquemaAnular.safeParse(datos);
  if (!p.success) return primerError(p.error.issues);
  const r = await llamar("anular_venta", "anular_venta", {
    p_venta: p.data.ventaId,
    p_motivo: p.data.motivo,
  });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/", "layout");
  return { ok: true };
}

const canalComprobante = z.enum(["correo", "whatsapp"]).nullable();

/** Deja el comprobante en el buzón: por un canal (correo o WhatsApp simulados) o, sin canal, por los dos. */
export async function enviarComprobante(
  ventaId: unknown,
  canal: unknown = null,
): Promise<ResultadoAccion<{ sinContacto: boolean }>> {
  const v = id.safeParse(ventaId);
  if (!v.success) return primerError(v.error.issues);
  const c = canalComprobante.safeParse(canal);
  if (!c.success) return primerError(c.error.issues);
  const r = await llamar("cobrar", "enviar_comprobante", {
    p_venta: v.data,
    ...(c.data ? { p_canal: c.data } : {}),
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, datos: { sinContacto: r.r.sinContacto === true } };
}

export async function verVenta(
  ventaId: unknown,
): Promise<ResultadoAccion<DetalleVenta>> {
  const v = id.safeParse(ventaId);
  if (!v.success) return primerError(v.error.issues);
  if (!(await miembroQuePuede("ver_ventas"))) return SIN_PERMISO;
  const detalle = await leerDetalleVenta(v.data);
  return detalle
    ? { ok: true, datos: detalle }
    : { ok: false, error: "La venta ya no existe" };
}

/** Ingreso, egreso o traspaso manual de la caja (solo el dueño). */
export async function registrarMovimiento(
  datos: unknown,
): Promise<ResultadoAccion> {
  const p = esquemaMovimiento.safeParse(datos);
  if (!p.success) return primerError(p.error.issues);
  const r = await llamar("ver_caja", "registrar_movimiento", { p: p.data });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/ventas/caja");
  return { ok: true };
}

export async function rectificarCaja(
  datos: unknown,
): Promise<
  ResultadoAccion<{ esperado: number; contado: number; diferencia: number }>
> {
  const p = esquemaRectificar.safeParse(datos);
  if (!p.success) return primerError(p.error.issues);
  const r = await llamar("ver_caja", "rectificar_caja", {
    p_local: p.data.localId,
    p_contado: p.data.contado,
  });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/ventas/caja");
  return {
    ok: true,
    datos: {
      esperado: Number(r.r.esperado),
      contado: Number(r.r.contado),
      diferencia: Number(r.r.diferencia),
    },
  };
}

/** Cambia el prefijo o adelanta el próximo número de venta (nunca lo atrasa). */
export async function ajustarNumeracion(
  datos: unknown,
): Promise<ResultadoAccion<{ sinCambios: boolean }>> {
  const p = esquemaNumeracion.safeParse(datos);
  if (!p.success) return primerError(p.error.issues);
  const r = await llamar("administrar", "ajustar_numeracion", {
    p_prefijo: p.data.prefijo,
    p_siguiente: p.data.siguiente,
  });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/administracion/numeracion");
  return { ok: true, datos: { sinCambios: r.r.sinCambios === true } };
}
