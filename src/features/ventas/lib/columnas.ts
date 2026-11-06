import type { ColumnaListado } from "@/shared/lib/csv";

/** Columnas del detalle de ventas; «Pagado» y «Saldo» se agregan con «Editar columnas». */
export const COLUMNAS_VENTAS = [
  { clave: "numero", nombre: "ID", fija: true },
  { clave: "fecha", nombre: "Fecha y hora" },
  { clave: "total", nombre: "Monto" },
  { clave: "pagado", nombre: "Pagado", oculta: true },
  { clave: "saldo", nombre: "Saldo", oculta: true },
  { clave: "cliente", nombre: "Cliente" },
  { clave: "metodos", nombre: "Método" },
  { clave: "estado", nombre: "Estado" },
] as const satisfies readonly ColumnaListado[];

/** Columnas del CSV de transacciones (cada pago o abono). */
export const COLUMNAS_PAGOS = [
  { clave: "fecha", nombre: "Fecha y hora" },
  { clave: "venta", nombre: "Venta", fija: true },
  { clave: "cliente", nombre: "Cliente" },
  { clave: "metodo", nombre: "Método" },
  { clave: "comprobante", nombre: "Comprobante" },
  { clave: "tipo", nombre: "Tipo" },
  { clave: "monto", nombre: "Monto" },
  { clave: "propina", nombre: "Propina" },
  { clave: "estado", nombre: "Estado de la venta" },
] as const satisfies readonly ColumnaListado[];
