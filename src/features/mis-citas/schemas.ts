import { z } from "zod";
import { normalizarTelefono } from "@/features/clientes/schemas";

const SLUG = z.string().regex(/^[a-z0-9-]{3,40}$/);

/** Correo (en minúsculas) o celular con indicativo (10 números que empiezan por 3 se toman de Colombia). */
export const esquemaDato = z
  .string()
  .trim()
  .min(1, "Escribe tu correo o tu celular")
  .max(120, "Máximo 120 caracteres")
  .transform((s) => (s.includes("@") ? s.toLowerCase() : normalizarTelefono(s)))
  .refine(
    (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) || /^\+[0-9]{8,15}$/.test(s),
    "Escribe un correo o un celular válido",
  );

export const esquemaPedirCodigo = z.object({ slug: SLUG, dato: esquemaDato });

export const esquemaEntrar = esquemaPedirCodigo.extend({
  codigo: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "El código tiene 6 números"),
});
