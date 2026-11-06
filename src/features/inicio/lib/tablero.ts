import { addDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { DiaHorario } from "@/features/administracion/schemas";
import { abiertosDelDia, type Rango } from "@/features/agenda/lib/horario";
import { diaSemana } from "@/features/agenda/lib/fechas";

/** Lo que ocupa a un profesional ese día: una cita activa, una clase o un bloqueo, en minutos. */
export interface Ocupado extends Rango {
  profesionalId: string;
}

export interface ProfesionalDia {
  id: string;
  horario: DiaHorario[];
}

/** Franja libre que se comparte en la historia: la ventana más larga en la que alguien puede atender. */
export interface FranjaLibre extends Rango {
  /** Minutos libres sumando a todos los profesionales, en todo el día. */
  minutosDelDia: number;
  /** Profesionales con un hueco dentro de la franja. */
  profesionales: number;
}

/** Huecos de menos de esto no cuentan (no cabe un servicio). */
export const MINIMO_HUECO = 30;

/** Intersección de dos listas de tramos (ordenados o no). */
function cruzar(a: Rango[], b: Rango[]): Rango[] {
  const out: Rango[] = [];
  for (const x of a)
    for (const y of b) {
      const inicio = Math.max(x.inicio, y.inicio);
      const fin = Math.min(x.fin, y.fin);
      if (fin > inicio) out.push({ inicio, fin });
    }
  return out.sort((r, s) => r.inicio - s.inicio);
}

/** Une tramos que se tocan o se pisan. */
function unir(tramos: Rango[]): Rango[] {
  const orden = [...tramos].sort((a, b) => a.inicio - b.inicio);
  const out: Rango[] = [];
  for (const t of orden) {
    const ultimo = out[out.length - 1];
    if (ultimo && t.inicio <= ultimo.fin)
      ultimo.fin = Math.max(ultimo.fin, t.fin);
    else out.push({ ...t });
  }
  return out;
}

/** Lo que queda de `tramos` al quitarles `quitar`. */
function restar(tramos: Rango[], quitar: Rango[]): Rango[] {
  const fuera = unir(quitar);
  const out: Rango[] = [];
  for (const t of tramos) {
    let cursor = t.inicio;
    for (const q of fuera) {
      if (q.fin <= cursor || q.inicio >= t.fin) continue;
      if (q.inicio > cursor) out.push({ inicio: cursor, fin: q.inicio });
      cursor = Math.max(cursor, q.fin);
    }
    if (cursor < t.fin) out.push({ inicio: cursor, fin: t.fin });
  }
  return out;
}

const largo = (r: Rango) => r.fin - r.inicio;

/**
 * Franja libre de un día (T-12.9): por profesional, su horario cruzado con el del local, menos citas, clases y
 * bloqueos; los huecos de 30 min o más de todos se juntan y gana la ventana más larga (la primera, si empatan).
 * Como todo sale del horario del local, la franja nunca pasa de la hora de cierre. null si no hay huecos.
 */
export function franjaLibre(p: {
  fecha: string;
  local: DiaHorario[];
  profesionales: ProfesionalDia[];
  ocupado: Ocupado[];
}): FranjaLibre | null {
  const dia = diaSemana(p.fecha);
  const abiertoLocal = abiertosDelDia(p.local.find((d) => d.dia === dia));
  if (abiertoLocal.length === 0) return null;

  const huecos = p.profesionales.map((pro) =>
    restar(
      cruzar(
        abiertoLocal,
        abiertosDelDia(pro.horario.find((d) => d.dia === dia)),
      ),
      p.ocupado.filter((o) => o.profesionalId === pro.id),
    ).filter((h) => largo(h) >= MINIMO_HUECO),
  );
  const ventanas = unir(huecos.flat());
  if (ventanas.length === 0) return null;
  const mejor = ventanas.reduce((a, b) => (largo(b) > largo(a) ? b : a));
  return {
    inicio: mejor.inicio,
    fin: mejor.fin,
    minutosDelDia: huecos.flat().reduce((s, h) => s + largo(h), 0),
    profesionales: huecos.filter((hs) =>
      hs.some((h) => h.inicio < mejor.fin && h.fin > mejor.inicio),
    ).length,
  };
}

/** Días que abre el local en la semana que sigue a hoy (de mañana a 7 días), en orden. */
export function diasAbiertos(hoy: string, local: DiaHorario[]): string[] {
  const out: string[] = [];
  for (let n = 1; n <= 7; n++) {
    const fecha = format(addDays(parseISO(hoy), n), "yyyy-MM-dd");
    const dia = local.find((d) => d.dia === diaSemana(fecha));
    if (abiertosDelDia(dia).length > 0) out.push(fecha);
  }
  return out;
}

/** "mañana", o "el sábado" si mañana el local no abre. */
export function cuandoEs(hoy: string, fecha: string): string {
  const manana = format(addDays(parseISO(hoy), 1), "yyyy-MM-dd");
  if (fecha === manana) return "mañana";
  return `el ${format(parseISO(fecha), "EEEE", { locale: es })}`;
}

/** Meta del mes: las reservas de este mes contra las del mes anterior completo. */
export interface Meta {
  actual: number;
  /** Las del mes anterior; null si el mes anterior no tuvo reservas (no hay con qué comparar). */
  objetivo: number | null;
  /** 0–100 para la barra. */
  porcentaje: number;
  superada: boolean;
}

export function metaDelMes(actual: number, anterior: number): Meta {
  if (anterior <= 0)
    return { actual, objetivo: null, porcentaje: 0, superada: false };
  return {
    actual,
    objetivo: anterior,
    porcentaje: Math.min(100, Math.round((actual / anterior) * 100)),
    superada: actual >= anterior,
  };
}

/**
 * Retención: de los clientes atendidos en el plazo, cuántos vinieron 2 veces o más (0–100). Recibe el cliente de
 * cada visita atendida; null si no vino nadie.
 */
export function retencion(visitas: string[]): number | null {
  const porCliente = new Map<string, number>();
  for (const c of visitas) porCliente.set(c, (porCliente.get(c) ?? 0) + 1);
  if (porCliente.size === 0) return null;
  const volvieron = [...porCliente.values()].filter((n) => n >= 2).length;
  return Math.round((volvieron / porCliente.size) * 100);
}

/** Total de ventas entre cuántas; null sin ventas. */
export function ticketPromedio(total: number, cantidad: number): number | null {
  return cantidad > 0 ? Math.round(total / cantidad) : null;
}

/** Primer y último día del mes de `hoy`, y el mes anterior completo. */
export function mesesDe(hoy: string): {
  mes: { desde: string; hasta: string };
  anterior: { desde: string; hasta: string };
} {
  const [a, m] = hoy.split("-").map(Number);
  const iso = (anio: number, mes: number, dia: number) =>
    `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  const diasDe = (anio: number, mes: number) =>
    new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const [aa, ma] = m === 1 ? [a - 1, 12] : [a, m - 1];
  return {
    mes: { desde: iso(a, m, 1), hasta: iso(a, m, diasDe(a, m)) },
    anterior: { desde: iso(aa, ma, 1), hasta: iso(aa, ma, diasDe(aa, ma)) },
  };
}
