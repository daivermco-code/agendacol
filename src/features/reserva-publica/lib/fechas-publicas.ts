import { addDays, differenceInCalendarDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { aISO, ahoraEnZona, deISO } from "@/features/agenda/lib/fechas";

/** Días adelante si el negocio no dice otra cosa (la base usa Ajustes → Sitio web). */
export const DIAS_ADELANTE = 60;

const mayus = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Hoy en la zona del local, 'YYYY-MM-DD'. */
export function hoyEn(zona: string): string {
  return ahoraEnZona(zona).fecha;
}

export function sumarDias(iso: string, dias: number): string {
  return aISO(addDays(deISO(iso), dias));
}

/** Primer día de la tira de 7 que contiene `fecha`, contando desde hoy (las tiras no se corren). */
export function inicioTira(fecha: string | null, hoy: string): string {
  if (!fecha || fecha <= hoy) return hoy;
  const n = differenceInCalendarDays(deISO(fecha), deISO(hoy));
  return sumarDias(hoy, Math.floor(n / 7) * 7);
}

/** "Lunes 7 de diciembre" */
export function fechaLarga(iso: string): string {
  return mayus(format(deISO(iso), "EEEE d 'de' MMMM", { locale: es }));
}

/** { semana: "Lun", numero: "7" } */
export function diaCorto(iso: string): { semana: string; numero: string } {
  const d = deISO(iso);
  return {
    semana: mayus(format(d, "EEE", { locale: es }).replace(".", "")),
    numero: format(d, "d"),
  };
}

/** "Diciembre 2026" */
export function mesAnio(iso: string): string {
  return mayus(format(deISO(iso), "MMMM yyyy", { locale: es }));
}
