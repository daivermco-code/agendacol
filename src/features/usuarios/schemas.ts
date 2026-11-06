import { z } from "zod";

export const esquemaInvitar = z
  .object({
    nombre: z.string().trim().min(2, "Escribe el nombre").max(80),
    correo: z
      .string()
      .trim()
      .toLowerCase()
      .email("El correo no es válido")
      .refine(
        (c) => c.endsWith(".test"),
        "En la demo, usa un correo inventado que termine en .test",
      ),
    rol: z.enum(["dueno", "recepcion", "profesional"]),
    profesionalId: z.string().uuid().optional(),
  })
  .refine((d) => d.rol !== "profesional" || d.profesionalId, {
    message: "Elige a qué profesional corresponde",
    path: ["profesionalId"],
  });

export type DatosInvitar = z.infer<typeof esquemaInvitar>;
