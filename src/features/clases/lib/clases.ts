import type { ClaseAgenda, ClaseCatalogo } from "@/features/agenda/types";
import type { DatosClase } from "../schemas";

/** Formulario de una clase nueva desde un hueco o desde "Nuevo" (la primera del catálogo, con su cupo). */
export function claseNueva(
  clase: ClaseCatalogo,
  localId: string,
  fecha: string,
  hora: string,
  profesionalId: string | null | undefined,
): DatosClase {
  const quien =
    profesionalId &&
    (clase.profesionales.length === 0 ||
      clase.profesionales.includes(profesionalId))
      ? profesionalId
      : (clase.profesionales[0] ?? profesionalId ?? "");
  return {
    id: null,
    localId,
    servicioId: clase.id,
    profesionalId: quien,
    fecha,
    horaInicio: hora,
    cupo: clase.cupo,
    veces: 1,
    nota: "",
  };
}

/** Formulario para editar una sesión que ya está en la agenda. */
export function claseDe(k: ClaseAgenda, localId: string): DatosClase {
  return {
    id: k.id,
    localId,
    servicioId: k.servicioId,
    profesionalId: k.profesionalId,
    fecha: k.fecha,
    horaInicio: k.horaInicio,
    cupo: k.cupo,
    veces: 1,
    nota: k.nota ?? "",
  };
}

/** "5 de 8 inscritos · quedan 3" o "Llena (8 de 8)". */
export function textoCupo(inscritos: number, cupo: number): string {
  if (inscritos >= cupo) return `Llena (${inscritos} de ${cupo})`;
  const quedan = cupo - inscritos;
  return `${inscritos} de ${cupo} inscritos · ${quedan === 1 ? "queda 1" : `quedan ${quedan}`}`;
}
