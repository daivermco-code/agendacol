import { z } from "zod";

const pesos = (minimo: number, mensaje: string) =>
  z
    .number({ error: mensaje })
    .int(mensaje)
    .min(minimo, mensaje)
    .max(10_000_000, mensaje);

/** Crear o editar una gift card del catálogo. */
export const esquemaModeloGiftCard = z.object({
  id: z.string().uuid().nullable(),
  nombre: z
    .string()
    .trim()
    .min(2, "Escribe el nombre (mínimo 2 letras)")
    .max(60, "Máximo 60 caracteres"),
  monto: pesos(1000, "El saldo va de $1.000 a $10.000.000"),
  precio: pesos(0, "Escribe el precio de venta"),
  vigenciaDias: z
    .number({ error: "La vigencia va de 30 a 730 días" })
    .int("La vigencia va de 30 a 730 días")
    .min(30, "La vigencia va de 30 a 730 días")
    .max(730, "La vigencia va de 30 a 730 días"),
  color: z.enum(["laguna", "coral", "violeta", "noche"]),
  activo: z.boolean(),
});
export type DatosModeloGiftCard = z.infer<typeof esquemaModeloGiftCard>;
