import {
  addDays,
  differenceInCalendarDays,
  format,
  getDaysInMonth,
  isSameMonth,
  parseISO,
  setDate,
  subMonths,
  subYears,
} from "date-fns";
import { es } from "date-fns/locale";
import { z } from "zod";
import type { Comparacion, PeriodoReporte } from "../types";

export const COMPARACIONES: { id: Comparacion; nombre: string }[] = [
  { id: "anterior", nombre: "Período anterior" },
  { id: "anio", nombre: "Mismo período del año pasado" },
  { id: "ninguna", nombre: "Sin comparar" },
];

/** Un reporte abarca hasta un año. */
export const DIAS_MAXIMOS = 366;

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((f) => !Number.isNaN(parseISO(f).getTime()))
  .catch("");

const esquema = z.object({
  desde: fecha,
  hasta: fecha,
  comparar: z.enum(["anterior", "anio", "ninguna"]).catch("anterior"),
});

/** El período con que se compara: el de igual largo justo antes (o el mes anterior), o el mismo del año pasado. */
export function periodoComparado(
  desde: string,
  hasta: string,
  comparar: Comparacion,
): { desde: string; hasta: string } | null {
  if (comparar === "ninguna") return null;
  const d = parseISO(desde);
  const h = parseISO(hasta);
  if (comparar === "anio")
    return { desde: iso(subYears(d, 1)), hasta: iso(subYears(h, 1)) };
  // Desde el día 1 y dentro del mismo mes ("Este mes", "Mes pasado"): los mismos días del mes anterior.
  if (d.getDate() === 1 && desde !== hasta && isSameMonth(d, h)) {
    const mes = subMonths(d, 1);
    const fin = Math.min(h.getDate(), getDaysInMonth(mes));
    return { desde: iso(mes), hasta: iso(setDate(mes, fin)) };
  }
  const largo = differenceInCalendarDays(h, d) + 1;
  return { desde: iso(addDays(d, -largo)), hasta: iso(addDays(d, -1)) };
}

/**
 * Lee el período de la dirección (?desde&hasta&comparar). Fechas malas o ausentes toman el período por defecto;
 * si vienen al revés se ordenan; nunca pasa de un año (se recorta desde `hasta`).
 */
export function leerPeriodo(
  params: Record<string, string | string[] | undefined>,
  porDefecto: { desde: string; hasta: string },
): PeriodoReporte {
  const p = esquema.parse({
    desde: params.desde,
    hasta: params.hasta,
    comparar: params.comparar,
  });
  const conFechas = Boolean(p.desde && p.hasta);
  let desde = conFechas ? p.desde : porDefecto.desde;
  let hasta = conFechas ? p.hasta : porDefecto.hasta;
  if (desde > hasta) [desde, hasta] = [hasta, desde];
  if (
    differenceInCalendarDays(parseISO(hasta), parseISO(desde)) >= DIAS_MAXIMOS
  )
    desde = iso(addDays(parseISO(hasta), -(DIAS_MAXIMOS - 1)));
  return {
    desde,
    hasta,
    comparar: p.comparar,
    anterior: periodoComparado(desde, hasta, p.comparar),
  };
}

/** Cambio porcentual con un decimal; null si antes no había nada con qué comparar. */
export function variacion(actual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return Math.round(((actual - anterior) / anterior) * 1000) / 10;
}

/** Parte de un total en porcentaje con un decimal (0 si el total es 0). */
export function porcentaje(parte: number, total: number): number {
  return total ? Math.round((parte / total) * 1000) / 10 : 0;
}

/** "2 oct – 31 oct 2026" (el año una sola vez si es el mismo). */
export function textoPeriodo(desde: string, hasta: string): string {
  const d = parseISO(desde);
  const h = parseISO(hasta);
  if (desde === hasta) return format(d, "d MMM yyyy", { locale: es });
  const mismoAno = d.getFullYear() === h.getFullYear();
  const inicio = format(d, mismoAno ? "d MMM" : "d MMM yyyy", { locale: es });
  return `${inicio} – ${format(h, "d MMM yyyy", { locale: es })}`;
}
