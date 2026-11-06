import { z } from "zod";
import { esFotoDelStorage } from "@/shared/lib/storage";

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const horaOpcional = z.union([
  z.literal(""),
  z.string().regex(HORA, "Hora no válida"),
]);
const telefonoOpcional = z.union([
  z.literal(""),
  z
    .string()
    .regex(
      /^\+[0-9]{8,15}$/,
      "Escribe el teléfono con indicativo, por ejemplo +573001234567",
    ),
]);
const correoOpcional = z.union([
  z.literal(""),
  z.string().trim().email("El correo no es válido"),
]);

export const ZONAS = [
  "America/Bogota",
  "America/Mexico_City",
  "America/Lima",
  "America/Santiago",
] as const;

export const esquemaLocal = z.object({
  /** null = local nuevo. */
  id: z.string().uuid().nullable(),
  nombre: z
    .string()
    .trim()
    .min(2, "Escribe el nombre del local")
    .max(80, "Máximo 80 letras"),
  direccion: z.string().trim().max(120, "Máximo 120 letras"),
  telefono: telefonoOpcional,
  aceptaWhatsapp: z.boolean(),
  correo: correoOpcional,
  zonaHoraria: z.enum(ZONAS),
  reservasEnLinea: z.boolean(),
  descripcion: z.string().trim().max(400, "Máximo 400 letras"),
});
export type DatosLocal = z.infer<typeof esquemaLocal>;

/** Un día del horario (local o profesional). `activo` = abierto / trabaja. */
export const esquemaDia = z
  .object({
    dia: z.number().int().min(1).max(7),
    activo: z.boolean(),
    inicio: horaOpcional,
    fin: horaOpcional,
    descanso: z.boolean(),
    descansoInicio: horaOpcional,
    descansoFin: horaOpcional,
  })
  .superRefine((d, ctx) => {
    if (!d.activo) return;
    if (!d.inicio || !d.fin) {
      ctx.addIssue({
        code: "custom",
        path: ["inicio"],
        message: "Pon la hora de apertura y la de cierre",
      });
      return;
    }
    if (d.inicio >= d.fin) {
      ctx.addIssue({
        code: "custom",
        path: ["fin"],
        message: "La hora de cierre debe ser después de la de apertura",
      });
    }
    if (d.descanso) {
      if (
        !d.descansoInicio ||
        !d.descansoFin ||
        d.descansoInicio >= d.descansoFin
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["descansoFin"],
          message: "El descanso debe terminar después de empezar",
        });
      } else if (d.descansoInicio < d.inicio || d.descansoFin > d.fin) {
        ctx.addIssue({
          code: "custom",
          path: ["descansoInicio"],
          message: "El descanso debe quedar dentro del horario",
        });
      }
    }
  });
export type DiaHorario = z.infer<typeof esquemaDia>;
export const esquemaHorario = z.array(esquemaDia).length(7);

export const esquemaCategoria = z.object({
  id: z.string().uuid().optional(),
  nombre: z
    .string()
    .trim()
    .min(2, "Escribe el nombre de la categoría")
    .max(60, "Máximo 60 letras"),
});

export const TIPOS_SERVICIO = [
  "servicio",
  "sesiones",
  "clase",
  "paquete",
] as const;
export type TipoServicio = (typeof TIPOS_SERVICIO)[number];

const enteroEntre = (minimo: number, maximo: number, mensaje: string) =>
  z
    .number({ message: mensaje })
    .int(mensaje)
    .min(minimo, mensaje)
    .max(maximo, mensaje);

export const esquemaServicio = z
  .object({
    id: z.string().uuid().optional(),
    /** Servicio, servicio con sesiones (se vende el total y cada cita gasta una), clase con cupo o paquete. */
    tipo: z.enum(TIPOS_SERVICIO).default("servicio"),
    sesiones: enteroEntre(2, 50, "Las sesiones van de 2 a 50")
      .nullable()
      .default(null),
    vigenciaDias: enteroEntre(30, 730, "La vigencia va de 30 a 730 días")
      .nullable()
      .default(null),
    cupo: enteroEntre(2, 100, "El cupo va de 2 a 100 personas")
      .nullable()
      .default(null),
    incluye: z
      .array(z.string().uuid())
      .max(6, "Un paquete lleva hasta 6 servicios")
      .default([]),
    nombre: z
      .string()
      .trim()
      .min(2, "Escribe el nombre del servicio")
      .max(80, "Máximo 80 letras"),
    categoriaId: z.string().uuid("Elige una categoría"),
    precio: z
      .number({ message: "Escribe el precio" })
      .int("Sin decimales")
      .min(0, "El precio no puede ser negativo"),
    duracionMin: z
      .number({ message: "Escribe la duración" })
      .int()
      .min(5, "La duración debe estar entre 5 y 720 minutos")
      .max(720, "La duración debe estar entre 5 y 720 minutos"),
    descripcion: z.string().trim().max(500, "Máximo 500 letras"),
    profesionales: z.array(z.string().uuid()),
    enLinea: z.boolean(),
    mostrarPrecio: z.boolean(),
    mostrarDuracion: z.boolean(),
    // Solo fotos subidas al bucket `servicios`: `next/image` no muestra otros hosts (`images.remotePatterns`).
    imagenes: z
      .array(
        z
          .string()
          .refine(
            (url) =>
              esFotoDelStorage(
                url,
                process.env.NEXT_PUBLIC_SUPABASE_URL,
                "servicios",
              ),
            "Una imagen no está en el Storage de este negocio: quítala y vuelve a subirla",
          ),
      )
      .max(3, "Máximo 3 imágenes"),
    activo: z.boolean(),
  })
  .superRefine((d, ctx) => {
    const falta = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (d.tipo === "sesiones" && d.sesiones === null)
      falta("sesiones", "Escribe cuántas sesiones trae");
    if (d.tipo === "clase" && d.cupo === null)
      falta("cupo", "Escribe el cupo de cada clase");
    if (d.tipo === "paquete" && d.incluye.length < 2)
      falta("incluye", "Elige al menos 2 servicios");
  });
export type DatosServicio = z.input<typeof esquemaServicio>;

export const esquemaProfesional = z.object({
  id: z.string().uuid().optional(),
  nombre: z
    .string()
    .trim()
    .min(2, "Escribe el nombre")
    .max(80, "Máximo 80 letras"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Elige un color"),
  localId: z.string().uuid("Elige un local"),
  servicios: z.array(z.string().uuid()),
  activo: z.boolean(),
  horario: esquemaHorario,
});
export type DatosProfesional = z.infer<typeof esquemaProfesional>;

export const esquemaOrden = z.array(z.string().uuid()).max(200);
