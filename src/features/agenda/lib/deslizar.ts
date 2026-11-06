/** Lo que se mide de un gesto en la agenda del celular. */
export interface Gesto {
  /** Movimiento del dedo en px (positivo = hacia la derecha / abajo). */
  dx: number;
  dy: number;
  /** Duración del gesto. Mantener presionado ~400 ms es arrastrar una cita, no deslizar. */
  ms: number;
  /** Si la cuadrícula ya estaba en su borde izquierdo o derecho al empezar (o no se desplaza de lado). */
  alInicio: boolean;
  alFinal: boolean;
}

export const DESLIZAR_MIN_PX = 60;
export const DESLIZAR_MAX_MS = 400;

/**
 * Deslizar de lado cambia de día o de rango (T-12.5): hacia la izquierda, el siguiente; hacia la derecha, el
 * anterior. Solo cuenta si el gesto es rápido, más horizontal que vertical y la cuadrícula ya está en el borde,
 * para no pelear con su propio desplazamiento.
 */
export function pasoDeslizar(g: Gesto): 1 | -1 | null {
  if (g.ms > DESLIZAR_MAX_MS) return null;
  if (Math.abs(g.dx) < DESLIZAR_MIN_PX) return null;
  if (Math.abs(g.dx) < 1.5 * Math.abs(g.dy)) return null;
  if (g.dx < 0) return g.alFinal ? 1 : null;
  return g.alInicio ? -1 : null;
}
