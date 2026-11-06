import { z } from "zod";

export const esquemaPlantilla = z.object({
  id: z.string().uuid().nullable(),
  nombre: z
    .string()
    .trim()
    .min(2, "Escribe el nombre (mínimo 2 letras)")
    .max(60, "Máximo 60 letras"),
  cuerpo: z
    .string()
    .trim()
    .min(2, "Escribe el mensaje")
    .max(600, "Máximo 600 letras"),
  activo: z.boolean(),
});
export type DatosPlantilla = z.infer<typeof esquemaPlantilla>;

export const esquemaEnvio = z.object({
  citaId: z.string().uuid(),
  plantillaId: z.string().uuid("Elige una plantilla"),
});
