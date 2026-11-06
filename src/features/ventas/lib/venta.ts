import { pesos } from "@/shared/lib/formato";

/** Cuentas del panel de venta. La base las vuelve a hacer al cerrar (cerrar_venta); aquí son para mostrar. */

export interface LineaVenta {
  cantidad: number;
  precioUnitario: number;
}

export interface LineaPago {
  monto: number;
  /** Solo en efectivo: lo que entregó el cliente. */
  recibido?: number | null;
  efectivo: boolean;
  /** Propina (0019): va aparte del monto; en efectivo, lo recibido la tiene que cubrir. */
  propina?: number;
}

export function subtotal(items: readonly LineaVenta[]): number {
  return items.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0);
}

/** Descuento en pesos, nunca mayor al subtotal. El porcentaje se redondea al peso. */
export function descuentoEnPesos(
  sub: number,
  modo: "pesos" | "porcentaje",
  valor: number,
): number {
  if (!Number.isFinite(valor) || valor <= 0) return 0;
  const pesos =
    modo === "porcentaje"
      ? Math.round((sub * Math.min(valor, 100)) / 100)
      : Math.round(valor);
  return Math.min(pesos, sub);
}

export function sumaPagos(pagos: readonly LineaPago[]): number {
  return pagos.reduce((s, p) => s + (p.monto > 0 ? p.monto : 0), 0);
}

/** Vuelto del efectivo: lo recibido de más en cada pago en efectivo (después del monto y la propina). */
export function vuelto(pagos: readonly LineaPago[]): number {
  return pagos.reduce((s, p) => {
    const cubre = p.monto + (p.propina ?? 0);
    return (
      s +
      (p.efectivo && p.recibido != null && p.recibido > cubre
        ? p.recibido - cubre
        : 0)
    );
  }, 0);
}

export type Revision =
  | { ok: true; suma: number; falta: number; vuelto: number; abono: boolean }
  | { ok: false; error: string; campo: "pagos" | "monto" | "recibido" };

/**
 * Revisa los pagos contra lo que falta por pagar, con los mismos mensajes de la base.
 * `abono` permite pagar menos que el saldo (queda en "Pago parcial").
 */
export function revisarPagos(
  saldo: number,
  pagos: readonly LineaPago[],
  abono: boolean,
): Revision {
  if (pagos.length > 5)
    return { ok: false, error: "Usa hasta 5 métodos de pago", campo: "pagos" };
  if (saldo > 0 && pagos.length === 0)
    return { ok: false, error: "Elige cómo paga el cliente", campo: "pagos" };
  for (const p of pagos) {
    if (!Number.isInteger(p.monto) || p.monto <= 0)
      return {
        ok: false,
        error: "Escribe un monto mayor a cero",
        campo: "monto",
      };
    if (!Number.isInteger(p.propina ?? 0) || (p.propina ?? 0) < 0)
      return { ok: false, error: "Revisa la propina", campo: "monto" };
    if (
      p.efectivo &&
      p.recibido != null &&
      p.recibido < p.monto + (p.propina ?? 0)
    )
      return {
        ok: false,
        error: "El monto recibido no alcanza",
        campo: "recibido",
      };
  }
  const suma = sumaPagos(pagos);
  if (suma > saldo)
    return { ok: false, error: "Los pagos superan el total", campo: "pagos" };
  if (suma < saldo && !abono)
    return {
      ok: false,
      error: `Falta por pagar ${pesos(saldo - suma)}`,
      campo: "pagos",
    };
  return {
    ok: true,
    suma,
    falta: saldo - suma,
    vuelto: vuelto(pagos),
    abono: suma < saldo,
  };
}

/** Lee un monto escrito a mano: "45.000", "$45000" o "45 000" → 45000. Vacío o inválido → null. */
export function leerPesos(texto: string): number | null {
  const limpio = texto.replace(/[^\d]/g, "");
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isSafeInteger(n) ? n : null;
}
