import { z } from "zod";

export const esquemaPrograma = z.object({
  activo: z.boolean(),
  meta: z
    .number({ message: "Escribe cuántos sellos llenan la tarjeta" })
    .int("Usa un número entero")
    .min(3, "Mínimo 3 sellos")
    .max(20, "Máximo 20 sellos"),
  premio: z
    .string()
    .trim()
    .min(2, "Escribe el premio")
    .max(80, "Máximo 80 letras"),
});
