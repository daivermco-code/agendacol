import {
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";

export interface Periodo {
  desde: string;
  hasta: string;
}

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** Atajos del selector de período, contados desde hoy (fecha de Bogotá). */
export function atajosPeriodo(
  hoy: string,
): { nombre: string; rango: Periodo }[] {
  const d = parseISO(hoy);
  const mesPasado = subMonths(d, 1);
  return [
    { nombre: "Hoy", rango: { desde: hoy, hasta: hoy } },
    {
      nombre: "Ayer",
      rango: { desde: iso(subDays(d, 1)), hasta: iso(subDays(d, 1)) },
    },
    {
      nombre: "Esta semana",
      rango: { desde: iso(startOfWeek(d, { weekStartsOn: 1 })), hasta: hoy },
    },
    {
      nombre: "Últimos 30 días",
      rango: { desde: iso(subDays(d, 29)), hasta: hoy },
    },
    { nombre: "Este mes", rango: { desde: iso(startOfMonth(d)), hasta: hoy } },
    {
      nombre: "Mes pasado",
      rango: {
        desde: iso(startOfMonth(mesPasado)),
        hasta: iso(endOfMonth(mesPasado)),
      },
    },
  ];
}
