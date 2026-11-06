import { z } from "zod";

const id = z.string().uuid();
const MAXIMO = 100_000_000;
const pesos = (mensaje: string) =>
  z
    .number({ error: mensaje })
    .int(mensaje)
    .min(0, mensaje)
    .max(MAXIMO, mensaje);

/** Un ítem de la venta: un servicio (con su cita, si se cobra una) o un ítem libre. */
export const esquemaItem = z.object({
  servicioId: id.nullable(),
  productoId: id.nullable().default(null),
  planId: id.nullable().default(null),
  giftCardModeloId: id.nullable().default(null),
  citaId: id.nullable(),
  profesionalId: id.nullable(),
  descripcion: z.string().trim().min(1, "Escribe qué se vende").max(120),
  cantidad: z
    .number()
    .int("La cantidad va de 1 a 99")
    .min(1, "La cantidad va de 1 a 99")
    .max(99, "La cantidad va de 1 a 99"),
  precioUnitario: pesos("Revisa el precio de los ítems"),
});

/** Un pago: método, monto y, en efectivo, lo que entregó el cliente (para el vuelto). */
export const esquemaPago = z.object({
  metodoId: id,
  monto: z
    .number()
    .int()
    .positive("Escribe un monto mayor a cero")
    .max(MAXIMO, "Revisa el monto"),
  recibido: z.number().int().positive().max(MAXIMO).nullable(),
  comprobante: z.string().trim().max(40, "Máximo 40 caracteres").nullable(),
  /** Propina para el profesional (0019): va aparte del monto y no entra a la caja. */
  propina: z
    .number()
    .int("Revisa la propina")
    .min(0, "Revisa la propina")
    .max(MAXIMO, "Revisa la propina")
    .default(0),
  /** Código de la gift card con que se paga (ABCD-EFGH). */
  giftCard: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z0-9]{4}-?[A-Z0-9]{4}$/,
      "El código lleva 8 letras y números, como ABCD-EFGH",
    )
    .transform((c) => (c.includes("-") ? c : `${c.slice(0, 4)}-${c.slice(4)}`))
    .nullable()
    .default(null),
});
export type PagoVenta = z.infer<typeof esquemaPago>;

export const esquemaCerrarVenta = z.object({
  localId: id,
  clienteId: id.nullable(),
  descuento: pesos("Revisa el descuento"),
  items: z
    .array(esquemaItem)
    .min(1, "Agrega al menos un ítem")
    .max(30, "Una venta lleva hasta 30 ítems"),
  pagos: z.array(esquemaPago).max(5, "Usa hasta 5 métodos de pago"),
});
export type DatosVenta = z.infer<typeof esquemaCerrarVenta>;

export const esquemaPagarSaldo = z.object({
  ventaId: id,
  pagos: z
    .array(esquemaPago)
    .min(1, "Elige cómo paga el cliente")
    .max(5, "Usa hasta 5 métodos de pago"),
});

export const esquemaAnular = z.object({
  ventaId: id,
  motivo: z
    .string()
    .trim()
    .min(3, "Escribe el motivo de la anulación")
    .max(200, "Máximo 200 caracteres"),
});

export const TIPOS_MOVIMIENTO = ["ingreso", "egreso", "traspaso"] as const;
export type TipoMovimientoManual = (typeof TIPOS_MOVIMIENTO)[number];

export const esquemaMovimiento = z.object({
  localId: id,
  tipo: z.enum(TIPOS_MOVIMIENTO, { error: "Elige el tipo de movimiento" }),
  monto: z
    .number({ error: "Escribe un monto mayor a cero" })
    .int("Escribe un monto sin centavos")
    .positive("Escribe un monto mayor a cero")
    .max(MAXIMO, "Revisa el monto"),
  concepto: z
    .string()
    .trim()
    .min(2, "Escribe el concepto")
    .max(120, "Máximo 120 caracteres"),
  efectivo: z.boolean(),
});

export const esquemaRectificar = z.object({
  localId: id,
  contado: pesos("Escribe el efectivo que contaste"),
});

export const esquemaNumeracion = z.object({
  prefijo: z
    .string()
    .trim()
    .toUpperCase()
    .max(6, "El prefijo lleva hasta 6 caracteres")
    .regex(
      /^([A-Z0-9-]*[A-Z-])?$/,
      "El prefijo lleva letras, números o guion, y termina en letra o guion",
    ),
  siguiente: z
    .number({ error: "Escribe el próximo número" })
    .int("Escribe un número entero")
    .min(1, "Escribe un número entre 1 y 99.999.999")
    .max(99_999_999, "Escribe un número entre 1 y 99.999.999"),
});
