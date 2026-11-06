import { z } from "zod";

const entero = (minimo: number, maximo: number, mensaje: string) =>
  z
    .number({ error: mensaje })
    .int(mensaje)
    .min(minimo, mensaje)
    .max(maximo, mensaje);

/** Crear o editar un plan. Sin sesiones = citas sin límite; sin servicios = sirve para todos. */
export const esquemaPlan = z.object({
  id: z.string().uuid().nullable(),
  nombre: z
    .string()
    .trim()
    .min(2, "Escribe el nombre (mínimo 2 letras)")
    .max(60, "Máximo 60 caracteres"),
  descripcion: z.string().trim().max(300, "Máximo 300 caracteres"),
  precio: entero(0, 100_000_000, "Escribe el precio"),
  vigenciaDias: entero(7, 730, "La vigencia va de 7 a 730 días"),
  sesiones: entero(1, 100, "Las citas van de 1 a 100").nullable(),
  servicios: z.array(z.string().uuid()).max(30, "Elige hasta 30 servicios"),
  activo: z.boolean(),
});
export type DatosPlan = z.infer<typeof esquemaPlan>;

export const esquemaUsarBono = z.object({
  citaId: z.string().uuid(),
  bonoId: z.string().uuid(),
});
