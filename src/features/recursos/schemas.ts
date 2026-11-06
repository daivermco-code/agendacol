import { z } from "zod";

export const esquemaRecurso = z.object({
  id: z.string().uuid().nullable(),
  localId: z.string().uuid("Elige el local"),
  nombre: z
    .string()
    .trim()
    .min(2, "Escribe el nombre (mínimo 2 letras)")
    .max(60, "Máximo 60 letras"),
  descripcion: z.string().trim().max(200, "Máximo 200 letras"),
  activo: z.boolean(),
  /** Servicios que lo usan: al agendarlos se asigna el primer recurso libre. */
  servicios: z.array(z.string().uuid()).max(80),
});
export type DatosRecurso = z.infer<typeof esquemaRecurso>;
