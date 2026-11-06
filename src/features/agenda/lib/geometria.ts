/** Alto en px de una fila (un bloque) de la cuadrícula. */
export const ALTO_FILA = 35;
/** Alto mínimo de una cita para que se lea el nombre. */
export const ALTO_MINIMO = 18;

export interface Escala {
  /** Minuto en que empieza la cuadrícula (múltiplo del bloque). */
  inicio: number;
  /** Minuto en que termina (múltiplo del bloque). */
  fin: number;
  /** Minutos por fila. */
  bloque: number;
}

/** Píxeles por minuto con esta escala. */
export function pxPorMinuto(escala: Escala): number {
  return ALTO_FILA / escala.bloque;
}

/** Posición y alto de un tramo; recortado a la escala visible. */
export function caja(
  escala: Escala,
  inicio: number,
  fin: number,
): { top: number; alto: number } {
  const desde = Math.max(inicio, escala.inicio);
  const hasta = Math.min(fin, escala.fin);
  const px = pxPorMinuto(escala);
  return {
    top: (desde - escala.inicio) * px,
    alto: Math.max(ALTO_MINIMO, (hasta - desde) * px - 2),
  };
}

/**
 * Rango visible según los horarios (local y profesionales) y las citas fuera de horario:
 * del primer inicio al último fin, redondeado al bloque y con 07:00–20:00 si no hay nada.
 */
export function escalaVisible(
  tramos: { inicio: number; fin: number }[],
  bloque: number,
): Escala {
  const validos = tramos.filter((t) => t.fin > t.inicio);
  const inicio = validos.length
    ? Math.min(...validos.map((t) => t.inicio))
    : 7 * 60;
  const fin = validos.length ? Math.max(...validos.map((t) => t.fin)) : 20 * 60;
  const paso = Math.max(bloque, 30);
  return {
    inicio: Math.floor(inicio / paso) * paso,
    fin: Math.min(24 * 60, Math.ceil(fin / paso) * paso),
    bloque,
  };
}

/** Minuto bajo un punto (y en px desde arriba de la cuadrícula), ajustado a la rejilla del bloque. */
export function minutoEn(
  escala: Escala,
  y: number,
  rejilla = escala.bloque,
): number {
  const minuto = escala.inicio + y / pxPorMinuto(escala);
  const ajustado = Math.floor(minuto / rejilla) * rejilla;
  return Math.min(Math.max(ajustado, escala.inicio), escala.fin - rejilla);
}

/** Etiquetas de hora de la columna izquierda. */
export function filas(escala: Escala): number[] {
  const out: number[] = [];
  for (let m = escala.inicio; m < escala.fin; m += escala.bloque) out.push(m);
  return out;
}
