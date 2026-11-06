import { z } from "zod";
import { normalizarTelefono } from "@/features/clientes/schemas";
import { MAX_UNIDADES } from "./lib/seleccion";

const FECHA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const HORA = /^([01]\d|2[0-3]):(00|30)$/;

export const esquemaToken = z
  .string()
  .regex(/^[0-9a-f]{32}$/, "Enlace no válido");
export const esquemaFecha = z.string().regex(FECHA, "Elige un día");
export const esquemaHora = z.string().regex(HORA, "Elige una hora");

/** Datos de contacto del paso 3 (todos obligatorios menos observaciones). */
export const esquemaDatosCliente = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "Escribe tu nombre")
    .max(60, "Máximo 60 letras"),
  apellido: z
    .string()
    .trim()
    .min(1, "Escribe tu apellido")
    .max(60, "Máximo 60 letras"),
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .max(120, "Máximo 120 caracteres")
    .email("Escribe un correo válido"),
  telefono: z
    .string()
    .transform(normalizarTelefono)
    .pipe(
      z
        .string()
        .regex(
          /^\+[0-9]{8,15}$/,
          "Escribe el teléfono con indicativo, por ejemplo +57 300 123 4567",
        ),
    ),
  nota: z.string().trim().max(500, "Máximo 500 letras"),
  autoriza: z.literal(true, {
    error: "Acepta el uso de tus datos para poder agendar",
  }),
});
export type DatosCliente = z.input<typeof esquemaDatosCliente>;

export const esquemaReserva = esquemaDatosCliente.extend({
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/),
  servicios: z
    .array(z.string().uuid())
    .min(1, "Elige al menos un servicio")
    .max(MAX_UNIDADES),
  profesionalId: z.string().uuid().nullable(),
  fecha: esquemaFecha,
  hora: esquemaHora,
});

export const esquemaBuscarDias = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/),
  servicios: z.array(z.string().uuid()).min(1).max(MAX_UNIDADES),
  profesionalId: z.string().uuid().nullable(),
  desde: esquemaFecha,
});

export const esquemaCalificacion = z.object({
  token: esquemaToken,
  estrellas: z
    .number()
    .int()
    .min(1, "Elige de 1 a 5 estrellas")
    .max(5, "Elige de 1 a 5 estrellas"),
  comentario: z.string().trim().max(500, "Máximo 500 letras"),
});

/** Lista de espera: los datos de contacto (sin observaciones) y lo que quiere ese día. */
export const esquemaEspera = esquemaDatosCliente.omit({ nota: true }).extend({
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/),
  servicios: z.array(z.string().uuid()).min(1).max(MAX_UNIDADES),
  profesionalId: z.string().uuid().nullable(),
  fecha: esquemaFecha,
  franja: z.enum(["dia", "manana", "tarde"], {
    error: "Elige en qué parte del día",
  }),
});
export type DatosEspera = z.input<typeof esquemaEspera>;
