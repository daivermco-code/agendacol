import type { ColumnaListado } from "@/shared/lib/csv";

/** Columnas de la base de clientes (la tabla y el CSV usan las mismas claves). */
export const COLUMNAS_CLIENTES = [
  { clave: "nombre", nombre: "Nombre", fija: true },
  { clave: "apellido", nombre: "Apellido", fija: true },
  { clave: "correo", nombre: "Correo" },
  { clave: "telefono", nombre: "Teléfono" },
  { clave: "documento", nombre: "Documento" },
] as const satisfies readonly ColumnaListado[];
