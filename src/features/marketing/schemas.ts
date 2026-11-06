import { z } from "zod";

const id = z.string().uuid();

export const esquemaFiltro = z
  .object({
    genero: z.enum(["femenino", "masculino", "otro"]).optional(),
    cumpleMes: z.number().int().min(0).max(12).optional(),
    servicioId: id.optional(),
    sinVenirDias: z.number().int().min(7).max(365).optional(),
    nuevosDias: z.number().int().min(1).max(365).optional(),
  })
  .strict();

export const esquemaAudiencia = z.object({
  id: id.nullable(),
  nombre: z
    .string()
    .trim()
    .min(2, "Ponle un nombre a la audiencia")
    .max(60, "Máximo 60 letras"),
  filtro: esquemaFiltro,
});

export const esquemaCampana = z.object({
  id: id.nullable(),
  audienciaId: id.nullable(),
  asunto: z
    .string()
    .trim()
    .min(2, "Escribe el asunto")
    .max(120, "Máximo 120 letras"),
  cuerpo: z
    .string()
    .trim()
    .min(2, "Escribe el mensaje")
    .max(2000, "Máximo 2.000 letras"),
});

export const esquemaSuscripcion = z.object({
  clienteId: id,
  recibe: z.boolean(),
});
