import type {
  BloqueoAgenda,
  CitaAgenda,
  ClaseAgenda,
  ProfesionalAgenda,
} from "../types";
import { diaSemana } from "./fechas";
import { abiertosDelDia, partirPorDia, type Rango } from "./horario";

/** Lo que tiene ocupado a un profesional en un tramo: una cita o una clase. */
export interface Ocupacion extends Rango {
  tipo: "cita" | "clase";
  /** Cliente de la cita, o el nombre de la clase. */
  quien: string;
  servicio: string;
}

export interface Atendiendo {
  profesional: ProfesionalAgenda;
  actual: Ocupacion;
  /** Minutos que le quedan a lo que está haciendo. */
  quedan: number;
  /** En los últimos 10 minutos. */
  terminando: boolean;
  /** Otras citas o clases que también están en curso (doble reserva). */
  ademas: number;
  siguiente: Ocupacion | null;
}

export interface Libre {
  profesional: ProfesionalAgenda;
  /** Minuto en que deja de estar libre; null = libre el resto del día. */
  hasta: number | null;
}

export type MotivoNoDisponible =
  "dia_libre" | "antes" | "descanso" | "termino" | "bloqueo";

export interface NoDisponible {
  profesional: ProfesionalAgenda;
  motivo: MotivoNoDisponible;
  /** Minuto en que vuelve (antes de empezar, en descanso o con bloqueo); null si no vuelve hoy. */
  vuelve: number | null;
  /** Motivo del bloqueo ("Almuerzo"). */
  detalle?: string;
  /** Inicio de su próxima cita o clase de hoy, aunque caiga fuera de su horario. */
  proxima: number | null;
}

export interface Ahora {
  atendiendo: Atendiendo[];
  libres: Libre[];
  noDisponibles: NoDisponible[];
}

/** Estados que no ocupan al profesional. */
const SIN_OCUPAR = new Set(["cancelado", "no_asistio"]);

const MINUTOS_TERMINANDO = 10;

/**
 * Vista "Ahora" (T-12.8): reparte a los profesionales en atendiendo, libres y no disponibles en el minuto dado.
 * Lo que está haciendo (cita o clase) manda sobre el horario: si atiende fuera de horario, está atendiendo.
 */
export function clasificarAhora(p: {
  profesionales: ProfesionalAgenda[];
  citas: CitaAgenda[];
  clases: ClaseAgenda[];
  bloqueos: BloqueoAgenda[];
  fecha: string;
  minutos: number;
}): Ahora {
  const m = p.minutos;
  const resultado: Ahora = { atendiendo: [], libres: [], noDisponibles: [] };

  for (const profesional of p.profesionales) {
    const ocupaciones = ocupacionesDe(profesional.id, p);
    const proxima = ocupaciones.find((o) => o.inicio > m) ?? null;
    const enCurso = ocupaciones.filter((o) => o.inicio <= m && m < o.fin);
    if (enCurso.length > 0) {
      // Con dos a la vez, está ocupado hasta que termine la que acaba más tarde.
      const actual = enCurso.reduce((a, b) => (b.fin > a.fin ? b : a));
      const quedan = actual.fin - m;
      resultado.atendiendo.push({
        profesional,
        actual,
        quedan,
        terminando: quedan <= MINUTOS_TERMINANDO,
        ademas: enCurso.length - 1,
        siguiente: proxima,
      });
      continue;
    }

    const bloqueos = p.bloqueos
      .filter((b) => b.profesionalId === profesional.id)
      .flatMap((b) =>
        partirPorDia(b.inicio, b.fin, [p.fecha]).map((r) => ({
          ...r,
          motivo: b.motivo,
        })),
      );
    const abiertos = abiertosDelDia(
      profesional.horario.find((d) => d.dia === diaSemana(p.fecha)),
    );
    const desde = (t: number) => disponibleDesde(t, abiertos, bloqueos);

    const bloqueo = bloqueos.find((b) => b.inicio <= m && m < b.fin);
    if (bloqueo) {
      resultado.noDisponibles.push({
        profesional,
        motivo: "bloqueo",
        vuelve: desde(bloqueo.fin),
        detalle: bloqueo.motivo,
        proxima: proxima?.inicio ?? null,
      });
      continue;
    }

    const tramo = abiertos.find((t) => t.inicio <= m && m < t.fin);
    if (!tramo) {
      resultado.noDisponibles.push({
        ...fueraDeHorario(profesional, abiertos, m, desde),
        proxima: proxima?.inicio ?? null,
      });
      continue;
    }

    // Libre hasta lo primero que lo ocupe dentro de este tramo, o hasta que cierra el tramo.
    const proximo = Math.min(
      ...[...ocupaciones, ...bloqueos]
        .filter((o) => o.inicio > m && o.inicio < tramo.fin)
        .map((o) => o.inicio),
      tramo.fin,
    );
    const ultimoTramo = tramo === abiertos[abiertos.length - 1];
    resultado.libres.push({
      profesional,
      hasta: proximo === tramo.fin && ultimoTramo ? null : proximo,
    });
  }

  resultado.atendiendo.sort((a, b) => a.quedan - b.quedan);
  resultado.libres.sort(
    (a, b) => (b.hasta ?? Infinity) - (a.hasta ?? Infinity),
  );
  return resultado;
}

/** Citas activas y clases del profesional ese día, por hora de inicio. */
function ocupacionesDe(
  profesionalId: string,
  p: { citas: CitaAgenda[]; clases: ClaseAgenda[]; fecha: string },
): Ocupacion[] {
  return [
    ...p.citas
      .filter(
        (c) =>
          c.profesionalId === profesionalId &&
          c.fecha === p.fecha &&
          !SIN_OCUPAR.has(c.estado),
      )
      .map((c): Ocupacion => ({
        tipo: "cita",
        inicio: c.inicio,
        fin: c.fin,
        quien: c.clienteNombre,
        servicio: c.servicioNombre,
      })),
    ...p.clases
      .filter(
        (k) =>
          k.profesionalId === profesionalId &&
          k.fecha === p.fecha &&
          !k.cancelada,
      )
      .map((k): Ocupacion => ({
        tipo: "clase",
        inicio: k.inicio,
        fin: k.fin,
        quien: k.servicioNombre,
        servicio: `${k.inscritos}/${k.cupo} inscritos`,
      })),
  ].sort((a, b) => a.inicio - b.inicio);
}

/** Fuera de su horario: día libre, todavía no empieza, en descanso o ya terminó. */
function fueraDeHorario(
  profesional: ProfesionalAgenda,
  abiertos: Rango[],
  m: number,
  desde: (t: number) => number | null,
): Omit<NoDisponible, "proxima"> {
  if (abiertos.length === 0)
    return { profesional, motivo: "dia_libre", vuelve: null };
  const despues = abiertos.find((t) => t.inicio > m);
  if (!despues) return { profesional, motivo: "termino", vuelve: null };
  return {
    profesional,
    motivo: despues === abiertos[0] ? "antes" : "descanso",
    vuelve: desde(despues.inicio),
  };
}

/**
 * Primer minuto desde `t` en que puede atender: dentro de su horario y sin bloqueo (salta bloqueos seguidos y el
 * descanso). null si ya no vuelve hoy.
 */
function disponibleDesde(
  t: number,
  abiertos: Rango[],
  bloqueos: Rango[],
): number | null {
  for (;;) {
    const bloqueo = bloqueos.find((b) => b.inicio <= t && t < b.fin);
    if (bloqueo) {
      t = bloqueo.fin;
      continue;
    }
    if (abiertos.some((a) => a.inicio <= t && t < a.fin)) return t;
    const siguiente = abiertos.find((a) => a.inicio > t);
    if (!siguiente) return null;
    t = siguiente.inicio;
  }
}

/**
 * Hora de la reserva rápida (T-12.8): la próxima de 15 en 15; si ya no está libre a esa hora, la próxima de 5 en
 * 5; si tampoco, este mismo minuto.
 */
export function horaReservaRapida(m: number, hasta: number | null): number {
  for (const paso of [15, 5]) {
    const hora = Math.ceil(m / paso) * paso;
    if (hasta === null || hora < hasta) return hora;
  }
  return m;
}
