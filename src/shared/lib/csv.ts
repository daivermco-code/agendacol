/** Una columna de un listado: clave estable (para la dirección y el navegador) y su título. */
export interface ColumnaListado {
  clave: string;
  nombre: string;
  /** No se puede quitar (la que identifica la fila). */
  fija?: boolean;
  /** Empieza oculta: se agrega con «Editar columnas». */
  oculta?: boolean;
}

export type Celda = string | number | null | undefined;

const PELIGROSAS = /^[=+\-@\t\r]/;

/**
 * Una celda lista para el CSV. Las que empiezan con = + - @ se anteponen con ' para que Excel no las ejecute como
 * fórmula (inyección CSV); los números van tal cual. Comillas, punto y coma y saltos de línea van entre comillas.
 */
export function celdaCsv(valor: Celda): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "number")
    return Number.isFinite(valor) ? String(valor) : "";
  const texto = PELIGROSAS.test(valor) ? `'${valor}` : valor;
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/**
 * CSV que Excel en español abre bien: separador punto y coma, saltos de Windows y marca UTF-8 al inicio (tildes).
 */
export function aCsv(
  columnas: Pick<ColumnaListado, "nombre">[],
  filas: Celda[][],
): string {
  const lineas = [
    columnas.map((c) => celdaCsv(c.nombre)),
    ...filas.map((f) => f.map(celdaCsv)),
  ];
  return `﻿${lineas.map((l) => l.join(";")).join("\r\n")}\r\n`;
}

/** Las columnas pedidas (por clave, en el orden del listado) o las visibles por defecto; las fijas siempre van. */
export function columnasElegidas<T extends ColumnaListado>(
  todas: readonly T[],
  pedidas: readonly string[] | null,
): T[] {
  if (!pedidas?.length) return todas.filter((c) => !c.oculta);
  return todas.filter((c) => c.fija || pedidas.includes(c.clave));
}

/** Dirección de «Exportar»: los filtros que se ven (sin la página) y, si se eligieron, las columnas. */
export function enlaceExportar(
  listado: string,
  filtros: Record<string, string | number | boolean>,
  columnas?: readonly Pick<ColumnaListado, "clave">[],
): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filtros))
    if (k !== "pagina" && k !== "por" && v !== "") p.set(k, String(v));
  if (columnas?.length) p.set("columnas", columnas.map((c) => c.clave).join(","));
  const q = p.toString();
  return `/api/exportar/${listado}${q ? `?${q}` : ""}`;
}
