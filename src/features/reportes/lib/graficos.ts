// Colores de los gráficos, validados con la guía de visualización (validate_palette.js) sobre la superficie
// #FEFEFF: tres tonos categóricos que se distinguen también con daltonismo, un gris de contexto para el período
// anterior (el actual es el que importa) y una escala de un solo tono para el mapa de calor. Son variables de
// globals.css: en modo noche los tonos suben de brillo y el mapa de calor va de oscuro a claro.
export const SERIES = [
  "var(--graf-serie-1)",
  "var(--graf-serie-2)",
  "var(--graf-serie-3)",
] as const;
export const ANTERIOR = "var(--graf-anterior)";
export const CALOR = [
  "var(--graf-calor-1)",
  "var(--graf-calor-2)",
  "var(--graf-calor-3)",
  "var(--graf-calor-4)",
] as const;
export const CELDA_VACIA = "var(--graf-vacia)";
export const REJILLA = "hsl(var(--ac-borde))";
export const TEXTO_EJE = "hsl(var(--ac-pizarra))";

/** Días ISO abreviados: 1 = lunes … 7 = domingo. */
export const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const UN_DECIMAL = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 1,
});

/** $1,2 M · $450 mil · $900 (para ejes y etiquetas cortas). */
export function pesosCortos(valor: number): string {
  const abs = Math.abs(valor);
  if (abs >= 1_000_000) return `$${UN_DECIMAL.format(valor / 1_000_000)} M`;
  if (abs >= 1_000) return `$${Math.round(valor / 1_000)} mil`;
  return `$${valor}`;
}

/** 12,5 % */
export function textoPorcentaje(valor: number): string {
  return `${UN_DECIMAL.format(valor)} %`;
}

/** 1.284 */
export function cifra(valor: number): string {
  return new Intl.NumberFormat("es-CO").format(valor);
}

/** Paso de la escala de calor (0–3) para un valor; -1 si es cero. */
export function pasoCalor(valor: number, maximo: number): number {
  if (valor <= 0 || maximo <= 0) return -1;
  return Math.min(
    CALOR.length - 1,
    Math.floor((valor / maximo) * CALOR.length - 1e-9),
  );
}
