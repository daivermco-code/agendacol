export interface Producto {
  id: string;
  nombre: string;
  categoria: string | null;
  precio: number;
  existencias: number;
  stockMinimo: number;
  activo: boolean;
}

export type TipoMovimientoStock = "entrada" | "venta" | "anulacion" | "ajuste";

export interface MovimientoStock {
  id: string;
  fecha: string;
  tipo: TipoMovimientoStock;
  cantidad: number;
  nota: string | null;
  quien: string | null;
}

/** Stock bajo: el producto tiene un mínimo y está en él o por debajo. */
export function enStockBajo(p: Pick<Producto, "existencias" | "stockMinimo">) {
  return p.stockMinimo > 0 && p.existencias <= p.stockMinimo;
}
