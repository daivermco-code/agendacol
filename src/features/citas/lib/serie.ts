import { addMonths, addWeeks, format, parseISO } from "date-fns";
import type { Repetir } from "../schemas";

/**
 * Fechas de una serie, igual que `guardar_cita` en la base: la primera más `veces - 1` saltos.
 * "Cada mes" del 31 cae en el último día de los meses cortos.
 */
export function fechasSerie(fecha: string, repetir: Repetir | null): string[] {
  if (!repetir) return [fecha];
  const base = parseISO(fecha);
  return Array.from({ length: repetir.veces }, (_, i) => {
    const d =
      repetir.cada === "mes"
        ? addMonths(base, i)
        : addWeeks(base, repetir.cada === "dos_semanas" ? i * 2 : i);
    return format(d, "yyyy-MM-dd");
  });
}

// Hora de reloj sin zona: se calcula como si fuera UTC para que ningún cambio de horario la mueva.
const reloj = (fechaHora: string) => Date.parse(`${fechaHora.slice(0, 16)}:00Z`);
const aTexto = (ms: number) => `${new Date(ms).toISOString().slice(0, 16)}:00`;

/** Inicio y fin de cada bloqueo de una serie, en hora de reloj del local ('YYYY-MM-DDTHH:mm:00'). */
export function tramosBloqueo(
  inicio: string,
  fin: string,
  repetir: Repetir | null,
): { inicio: string; fin: string }[] {
  const largo = reloj(fin) - reloj(inicio);
  const hora = inicio.slice(11, 16);
  return fechasSerie(inicio.slice(0, 10), repetir).map((f) => {
    const desde = reloj(`${f}T${hora}`);
    return { inicio: aTexto(desde), fin: aTexto(desde + largo) };
  });
}
