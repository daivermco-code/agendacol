import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { TZDate } from "@date-fns/tz";

export const ZONA_LOCAL = "America/Bogota";
/** "3dias" es solo del celular (Fase 12): desde la tableta se ve como la semana. */
export type Vista = "semana" | "dia" | "3dias" | "mes" | "lista";

/** 'YYYY-MM-DD' sin pasar por UTC (nunca `new Date('YYYY-MM-DD')`). */
export function aISO(fecha: Date): string {
  return format(fecha, "yyyy-MM-dd");
}

/** Fecha local a medianoche desde 'YYYY-MM-DD'. */
export function deISO(iso: string): Date {
  return parseISO(iso);
}

/** "Ahora" en la zona del local, como fecha y minutos desde medianoche. */
export function ahoraEnZona(
  zona = ZONA_LOCAL,
  ahora: Date = new Date(),
): { fecha: string; minutos: number } {
  const z = new TZDate(ahora, zona);
  return {
    fecha: format(z, "yyyy-MM-dd"),
    minutos: z.getHours() * 60 + z.getMinutes(),
  };
}

/**
 * Rango visible (inclusive) para una vista: semana lunes–domingo, día, 3 días desde el ancla (así "Hoy" queda
 * primero), mes completo por semanas, lista = semana.
 */
export function rangoDeVista(
  vista: Vista,
  ancla: string,
): { desde: string; hasta: string; dias: string[] } {
  const d = deISO(ancla);
  let desde: Date;
  let hasta: Date;
  if (vista === "dia") {
    desde = d;
    hasta = d;
  } else if (vista === "3dias") {
    desde = d;
    hasta = addDays(d, 2);
  } else if (vista === "mes") {
    desde = startOfWeek(startOfMonth(d), { weekStartsOn: 1 });
    hasta = endOfWeek(endOfMonth(d), { weekStartsOn: 1 });
  } else {
    desde = startOfWeek(d, { weekStartsOn: 1 });
    hasta = endOfWeek(d, { weekStartsOn: 1 });
  }
  const dias: string[] = [];
  for (let x = desde; x <= hasta; x = addDays(x, 1)) dias.push(aISO(x));
  return { desde: aISO(desde), hasta: aISO(hasta), dias };
}

/** Ancla siguiente o anterior según la vista. */
export function moverAncla(vista: Vista, ancla: string, paso: 1 | -1): string {
  const d = deISO(ancla);
  if (vista === "dia") return aISO(addDays(d, paso));
  if (vista === "3dias") return aISO(addDays(d, 3 * paso));
  if (vista === "mes") return aISO(addMonths(d, paso));
  return aISO(addDays(d, 7 * paso));
}

/** "Lun 26/10 – Dom 01/11", "Sábado 31 de octubre", "Octubre 2026". */
export function tituloRango(vista: Vista, ancla: string): string {
  const { desde, hasta } = rangoDeVista(vista, ancla);
  const mayus = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  if (vista === "dia")
    return mayus(format(deISO(ancla), "EEEE d 'de' MMMM", { locale: es }));
  if (vista === "mes")
    return mayus(format(deISO(ancla), "MMMM yyyy", { locale: es }));
  const corto = (iso: string) =>
    mayus(format(deISO(iso), "EEE dd/MM", { locale: es }).replace(".", ""));
  return `${corto(desde)} – ${corto(hasta)}`;
}

/** 'HH:mm' o 'HH:mm:ss' → minutos desde medianoche. */
export function aMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

/** Minutos → 'HH:mm'. */
export function aHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Día ISO de la semana (1 = lunes … 7 = domingo) de 'YYYY-MM-DD'. */
export function diaSemana(iso: string): number {
  const d = deISO(iso).getDay();
  return d === 0 ? 7 : d;
}

/** Cabecera de la agenda en el celular: "jue 5 nov", "5 – 7 nov", "30 nov – 2 dic" o "Noviembre 2026". */
export function tituloCorto(vista: Vista, ancla: string): string {
  const { desde, hasta } = rangoDeVista(vista, ancla);
  const f = (iso: string, patron: string) =>
    format(deISO(iso), patron, { locale: es }).replaceAll(".", "");
  if (vista === "dia") return f(ancla, "EEE d MMM");
  if (vista === "mes") {
    const t = f(ancla, "MMMM yyyy");
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  const otroAnio = desde.slice(0, 4) !== hasta.slice(0, 4);
  if (desde.slice(0, 7) === hasta.slice(0, 7))
    return `${f(desde, "d")} – ${f(hasta, "d MMM")}`;
  return otroAnio
    ? `${f(desde, "d MMM yyyy")} – ${f(hasta, "d MMM yyyy")}`
    : `${f(desde, "d MMM")} – ${f(hasta, "d MMM")}`;
}
