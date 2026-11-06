import type { DiaHorario } from "@/features/administracion/schemas";
import { aMinutos } from "./fechas";

export interface Rango {
  inicio: number;
  fin: number;
}

/** Tramos abiertos de un día del horario (el descanso parte el día en dos). */
export function abiertosDelDia(dia: DiaHorario | undefined): Rango[] {
  if (!dia?.activo || !dia.inicio || !dia.fin) return [];
  const inicio = aMinutos(dia.inicio);
  const fin = aMinutos(dia.fin);
  if (fin <= inicio) return [];
  if (!dia.descanso || !dia.descansoInicio || !dia.descansoFin)
    return [{ inicio, fin }];
  const di = aMinutos(dia.descansoInicio);
  const df = aMinutos(dia.descansoFin);
  return [
    { inicio, fin: Math.max(inicio, di) },
    { inicio: Math.min(fin, df), fin },
  ].filter((r) => r.fin > r.inicio);
}

/** Lo que queda fuera de los tramos abiertos dentro de [desde, hasta) — se pinta en gris. */
export function cerrados(
  abiertos: Rango[],
  desde: number,
  hasta: number,
): Rango[] {
  const orden = [...abiertos].sort((a, b) => a.inicio - b.inicio);
  const out: Rango[] = [];
  let cursor = desde;
  for (const r of orden) {
    if (r.inicio > cursor)
      out.push({ inicio: cursor, fin: Math.min(r.inicio, hasta) });
    cursor = Math.max(cursor, r.fin);
    if (cursor >= hasta) break;
  }
  if (cursor < hasta) out.push({ inicio: cursor, fin: hasta });
  return out.filter((r) => r.fin > r.inicio);
}

/** Parte un tramo 'YYYY-MM-DDTHH:mm' → 'YYYY-MM-DDTHH:mm' en un rango por día de los días pedidos. */
export function partirPorDia(
  inicio: string,
  fin: string,
  dias: string[],
): ({ fecha: string } & Rango)[] {
  const fi = inicio.slice(0, 10);
  const ff = fin.slice(0, 10);
  const out: ({ fecha: string } & Rango)[] = [];
  for (const fecha of dias) {
    if (fecha < fi || fecha > ff) continue;
    const desde = fecha === fi ? aMinutos(inicio.slice(11, 16)) : 0;
    const hasta = fecha === ff ? aMinutos(fin.slice(11, 16)) : 24 * 60;
    if (hasta > desde) out.push({ fecha, inicio: desde, fin: hasta });
  }
  return out;
}

/** ¿Algún tramo ocupa parte de [inicio, fin)? */
export function ocupado(tramos: Rango[], inicio: number, fin: number): boolean {
  return tramos.some((t) => t.inicio < fin && t.fin > inicio);
}
