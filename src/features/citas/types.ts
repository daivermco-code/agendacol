export type TipoChoque =
  | "cita_profesional"
  | "cita_cliente"
  | "fuera_horario"
  | "descanso"
  | "bloqueo"
  | "recurso";

export interface Choque {
  tipo: TipoChoque;
  resumen: string;
}

/** Choques de una fecha (una cita sola tiene una; una serie, una por fecha). */
export interface RevisionFecha {
  fecha: string;
  choques: Choque[];
}

export type ResultadoGuardar =
  | { ok: true; citaIds: string[] }
  | { ok: false; choques: RevisionFecha[]; puedeForzar: boolean }
  | { ok: false; error: string; campo?: string };

export type ResultadoRevision =
  | { ok: true; revision: RevisionFecha[]; puedeForzar: boolean }
  | { ok: false; error: string };

export type ResultadoSimple = { ok: true } | { ok: false; error: string };
