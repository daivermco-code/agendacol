import { z } from "zod";
import {
  ESTADOS_ACTIVOS,
  type EstadoCita,
} from "@/features/agenda/lib/estados";
import { aMinutos } from "@/features/agenda/lib/fechas";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const uuid = (mensaje: string) => z.string({ error: mensaje }).uuid(mensaje);
const fecha = z.string().regex(FECHA, "Elige una fecha");
const hora = z.string().regex(HORA, "Elige una hora");

export const CADAS = ["semana", "dos_semanas", "mes"] as const;
export type Cada = (typeof CADAS)[number];
export const NOMBRE_CADA: Record<Cada, string> = {
  semana: "Cada semana",
  dos_semanas: "Cada 2 semanas",
  mes: "Cada mes",
};

export const esquemaRepetir = z.object({
  cada: z.enum(CADAS),
  veces: z
    .number()
    .int()
    .min(2, "Repite al menos 2 veces")
    .max(12, "Máximo 12 veces"),
});
export type Repetir = z.infer<typeof esquemaRepetir>;

/** Alcance de un cambio en una cita que es parte de una serie. */
export const esquemaAlcance = z.enum(["solo_esta", "esta_y_siguientes"]);
export type Alcance = z.infer<typeof esquemaAlcance>;
export const esquemaAlcanceCancelar = z.enum([
  "solo_esta",
  "esta_y_siguientes",
  "toda_la_serie",
]);
export type AlcanceCancelar = z.infer<typeof esquemaAlcanceCancelar>;

const ESTADOS_RESERVA = ESTADOS_ACTIVOS as [EstadoCita, ...EstadoCita[]];

export const esquemaCita = z
  .object({
    id: z.string().uuid().optional(),
    localId: z.string().uuid(),
    clienteId: uuid("Elige un cliente"),
    profesionalId: uuid("Elige un profesional"),
    servicioId: uuid("Elige un servicio"),
    recursoId: z.string().uuid().nullable().default(null),
    fecha,
    horaInicio: hora,
    duracionMin: z.number().int().min(5).max(720),
    precio: z
      .number({ error: "Escribe el precio" })
      .int("El precio va sin decimales")
      .min(0, "El precio no puede ser negativo"),
    estado: z.enum(ESTADOS_RESERVA),
    profesionalFijo: z.boolean(),
    notaCliente: z.string().trim().max(500, "Máximo 500 letras"),
    notaInterna: z.string().trim().max(500, "Máximo 500 letras"),
    avisoCorreo: z.boolean(),
    avisoWhatsapp: z.boolean(),
    repetir: esquemaRepetir.nullable(),
    omitir: z.array(fecha).max(12),
  })
  .superRefine((d, ctx) => {
    if (
      HORA.test(d.horaInicio) &&
      aMinutos(d.horaInicio) + d.duracionMin > 24 * 60
    )
      ctx.addIssue({
        code: "custom",
        path: ["horaInicio"],
        message: "La cita no puede pasar de la medianoche",
      });
  });
export type DatosCita = z.infer<typeof esquemaCita>;

export const esquemaBloqueo = z
  .object({
    id: z.string().uuid().optional(),
    profesionalId: uuid("Elige un profesional"),
    motivo: z
      .string()
      .trim()
      .min(1, "Escribe el motivo")
      .max(80, "Máximo 80 letras"),
    fechaInicio: fecha,
    horaInicio: hora,
    fechaFin: fecha,
    horaFin: hora,
    repetir: esquemaRepetir.nullable(),
  })
  .superRefine((d, ctx) => {
    if (`${d.fechaFin}T${d.horaFin}` <= `${d.fechaInicio}T${d.horaInicio}`)
      ctx.addIssue({
        code: "custom",
        path: ["horaFin"],
        message: "El fin debe ser después del inicio",
      });
  });
export type DatosBloqueo = z.infer<typeof esquemaBloqueo>;
