import type {
  BloqueoAgenda,
  BloqueoDia,
  CitaAgenda,
  ClaseAgenda,
  LocalAgenda,
  ProfesionalAgenda,
  RecursoAgenda,
} from "../types";
import { diaSemana } from "./fechas";
import type { Escala } from "./geometria";
import { abiertosDelDia, cerrados, partirPorDia, type Rango } from "./horario";

export interface ColumnaGrid {
  clave: string;
  fecha: string;
  /** Profesional de la columna (vista día) o el filtrado (vista semana); null = todos. */
  profesional: ProfesionalAgenda | null;
  /** Vista por recursos: el recurso de la columna. */
  recurso?: RecursoAgenda;
  cerrados: Rango[];
  citas: CitaAgenda[];
  bloqueos: BloqueoDia[];
  clases: ClaseAgenda[];
}

function bloqueosDelDia(
  bloqueos: BloqueoAgenda[],
  fecha: string,
  incluye: (profesionalId: string) => boolean,
  nombre?: (profesionalId: string) => string,
): BloqueoDia[] {
  return bloqueos
    .filter((b) => incluye(b.profesionalId))
    .flatMap((b) =>
      partirPorDia(b.inicio, b.fin, [fecha]).map((r) => ({
        id: b.id,
        profesionalId: b.profesionalId,
        motivo: nombre ? `${b.motivo} · ${nombre(b.profesionalId)}` : b.motivo,
        ...r,
      })),
    );
}

const primerNombre = (profesionales: ProfesionalAgenda[]) => (id: string) =>
  profesionales.find((p) => p.id === id)?.nombre.split(" ")[0] ?? "";

/** Vista semana: una columna por día; gris según el horario del profesional elegido o del local. */
export function columnasSemana(p: {
  dias: string[];
  local: LocalAgenda;
  profesional: ProfesionalAgenda | null;
  profesionales: ProfesionalAgenda[];
  citas: CitaAgenda[];
  bloqueos: BloqueoAgenda[];
  clases?: ClaseAgenda[];
  escala: Escala;
}): ColumnaGrid[] {
  const horario = p.profesional?.horario ?? p.local.horario;
  const delProfesional = (id: string) =>
    !p.profesional || id === p.profesional.id;
  return p.dias.map((fecha) => ({
    clave: fecha,
    fecha,
    profesional: p.profesional,
    cerrados: cerrados(
      abiertosDelDia(horario.find((d) => d.dia === diaSemana(fecha))),
      p.escala.inicio,
      p.escala.fin,
    ),
    citas: p.citas.filter(
      (c) => c.fecha === fecha && delProfesional(c.profesionalId),
    ),
    bloqueos: bloqueosDelDia(
      p.bloqueos,
      fecha,
      delProfesional,
      p.profesional ? undefined : primerNombre(p.profesionales),
    ),
    clases: (p.clases ?? []).filter(
      (k) => k.fecha === fecha && delProfesional(k.profesionalId),
    ),
  }));
}

/** Vista día: una columna por profesional con su propio horario. */
export function columnasDia(p: {
  fecha: string;
  profesionales: ProfesionalAgenda[];
  citas: CitaAgenda[];
  bloqueos: BloqueoAgenda[];
  clases?: ClaseAgenda[];
  escala: Escala;
}): ColumnaGrid[] {
  const dia = diaSemana(p.fecha);
  return p.profesionales.map((prof) => ({
    clave: prof.id,
    fecha: p.fecha,
    profesional: prof,
    cerrados: cerrados(
      abiertosDelDia(prof.horario.find((d) => d.dia === dia)),
      p.escala.inicio,
      p.escala.fin,
    ),
    citas: p.citas.filter(
      (c) => c.fecha === p.fecha && c.profesionalId === prof.id,
    ),
    bloqueos: bloqueosDelDia(p.bloqueos, p.fecha, (id) => id === prof.id),
    clases: (p.clases ?? []).filter(
      (k) => k.fecha === p.fecha && k.profesionalId === prof.id,
    ),
  }));
}

/** Vista día por recursos: una columna por recurso del local con las citas que lo ocupan. */
export function columnasRecursos(p: {
  fecha: string;
  local: LocalAgenda;
  recursos: RecursoAgenda[];
  citas: CitaAgenda[];
  escala: Escala;
}): ColumnaGrid[] {
  const abiertos = abiertosDelDia(
    p.local.horario.find((d) => d.dia === diaSemana(p.fecha)),
  );
  return p.recursos.map((recurso) => ({
    clave: recurso.id,
    fecha: p.fecha,
    profesional: null,
    recurso,
    cerrados: cerrados(abiertos, p.escala.inicio, p.escala.fin),
    citas: p.citas.filter(
      (c) => c.fecha === p.fecha && c.recursoId === recurso.id,
    ),
    bloqueos: [],
    clases: [],
  }));
}
