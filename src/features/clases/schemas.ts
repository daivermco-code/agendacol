import { z } from "zod";

const id = z.string().uuid();
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Crear una clase (se puede repetir cada semana) o editar una sesión. */
export const esquemaClase = z.object({
  id: id.nullable(),
  localId: id,
  servicioId: id.nullable(),
  profesionalId: z.string().uuid("Elige quién da la clase"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige el día"),
  horaInicio: z.string().regex(HORA, "Elige la hora"),
  cupo: z
    .number({ error: "Escribe el cupo" })
    .int("El cupo va de 1 a 100")
    .min(1, "El cupo va de 1 a 100")
    .max(100, "El cupo va de 1 a 100"),
  veces: z.number().int().min(1).max(12),
  nota: z.string().trim().max(300, "Máximo 300 caracteres"),
});
export type DatosClase = z.infer<typeof esquemaClase>;

export const ESTADOS_INSCRITO = [
  "inscrito",
  "asiste",
  "no_asistio",
  "cancelado",
] as const;
export type EstadoInscrito = (typeof ESTADOS_INSCRITO)[number];

export const esquemaInscribir = z.object({
  claseId: id,
  clienteId: id,
  bonoId: id.nullable(),
});

export const esquemaEstadoInscrito = z.object({
  inscritoId: id,
  estado: z.enum(ESTADOS_INSCRITO),
});
