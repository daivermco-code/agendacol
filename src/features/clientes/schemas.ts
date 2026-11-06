import { z } from "zod";

/** "+57 300 123 4567", "300 123 4567" o "3001234567" → "+573001234567" (Colombia si no trae indicativo). */
export function normalizarTelefono(texto: string): string {
  const limpio = texto.replace(/[\s().-]/g, "");
  if (!limpio || limpio.startsWith("+")) return limpio;
  if (/^3\d{9}$/.test(limpio)) return `+57${limpio}`;
  if (/^57\d{10}$/.test(limpio)) return `+${limpio}`;
  return limpio;
}

/** Cliente creado o completado desde la ventana de reserva (la ficha completa llega con Clientes). */
export const esquemaClienteRapido = z.object({
  id: z.string().uuid().optional(),
  nombre: z
    .string()
    .trim()
    .min(1, "Escribe el nombre")
    .max(60, "Máximo 60 letras"),
  apellido: z
    .string()
    .trim()
    .min(1, "Escribe el apellido")
    .max(60, "Máximo 60 letras"),
  documento: z.string().trim().max(20, "Máximo 20 caracteres"),
  correo: z.union([
    z.literal(""),
    z.string().trim().toLowerCase().email("El correo no es válido"),
  ]),
  telefono: z
    .string()
    .transform(normalizarTelefono)
    .pipe(
      z.union([
        z.literal(""),
        z
          .string()
          .regex(
            /^\+[0-9]{8,15}$/,
            "Escribe el teléfono con indicativo, por ejemplo +57 300 123 4567",
          ),
      ]),
    ),
});
export type DatosClienteRapido = z.input<typeof esquemaClienteRapido>;

/** Lo que la reserva muestra de un cliente. */
export interface ClienteResumen {
  id: string;
  nombre: string;
  apellido: string;
  documento: string | null;
  correo: string | null;
  telefono: string | null;
  creado: string;
}

const texto = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`);

/** Ficha completa del cliente (Clientes → Nuevo / Editar), en dos bloques como flujos.md §2. */
export const esquemaCliente = esquemaClienteRapido
  .extend({
    fechaNacimiento: z.union([
      z.literal(""),
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida")
        .refine((f) => f <= new Date().toISOString().slice(0, 10), "La fecha no puede ser futura"),
    ]),
    genero: z.enum(["", "femenino", "masculino", "otro"]),
    numeroCliente: texto(20),
    direccion: texto(120),
    barrio: texto(60),
    municipio: texto(60),
  })
  .refine((d) => !d.telefono.startsWith("+57") || d.telefono.length === 13, {
    message: "El número de Colombia tiene 10 dígitos",
    path: ["telefono"],
  });
export type DatosCliente = z.input<typeof esquemaCliente>;

export const CLIENTE_VACIO: DatosCliente = {
  nombre: "",
  apellido: "",
  documento: "",
  correo: "",
  telefono: "",
  fechaNacimiento: "",
  genero: "",
  numeroCliente: "",
  direccion: "",
  barrio: "",
  municipio: "",
};
