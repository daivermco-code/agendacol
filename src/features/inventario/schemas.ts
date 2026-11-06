import { z } from "zod";

const entero = (minimo: number, maximo: number, mensaje: string) =>
  z
    .number({ error: mensaje })
    .int(mensaje)
    .min(minimo, mensaje)
    .max(maximo, mensaje);

/** Crear o editar un producto. Las existencias iniciales solo cuentan al crearlo (entran como movimiento). */
export const esquemaProducto = z.object({
  id: z.string().uuid().nullable(),
  nombre: z
    .string()
    .trim()
    .min(2, "Escribe el nombre (mínimo 2 letras)")
    .max(80, "Máximo 80 caracteres"),
  categoria: z
    .string()
    .trim()
    .max(40, "La categoría lleva hasta 40 caracteres"),
  precio: entero(0, 100_000_000, "Escribe el precio de venta"),
  stockMinimo: entero(0, 9999, "El mínimo va de 0 a 9.999"),
  existenciasIniciales: entero(0, 9999, "Las existencias van de 0 a 9.999"),
  activo: z.boolean(),
});
export type DatosProducto = z.infer<typeof esquemaProducto>;

export const PRODUCTO_VACIO: DatosProducto = {
  id: null,
  nombre: "",
  categoria: "",
  precio: 0,
  stockMinimo: 3,
  existenciasIniciales: 0,
  activo: true,
};

/** Entrada de mercancía (suma) o conteo físico (deja las existencias en lo contado). */
export const esquemaExistencias = z
  .object({
    productoId: z.string().uuid(),
    tipo: z.enum(["entrada", "conteo"], { error: "Elige qué vas a registrar" }),
    cantidad: entero(0, 99_999, "Escribe la cantidad"),
    nota: z.string().trim().max(120, "Máximo 120 caracteres"),
  })
  .refine((d) => d.tipo === "conteo" || d.cantidad >= 1, {
    message: "Escribe cuántas unidades entraron",
    path: ["cantidad"],
  });
export type DatosExistencias = z.infer<typeof esquemaExistencias>;
