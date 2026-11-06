import { z } from "zod";

export const esquemaEntrar = z.object({
  correo: z.string().trim().email("Escribe un correo válido"),
  clave: z.string().min(1, "Escribe tu contraseña"),
});

export type DatosEntrar = z.infer<typeof esquemaEntrar>;

export const esquemaClaveDemo = z.enum([
  "dueno",
  "recepcion",
  "profesional",
  "andres",
  "valentina",
  "julian",
]);

/** Solo rutas internas: evita que `?volver=` mande a otro sitio. */
export function rutaSegura(volver: unknown): string {
  if (typeof volver !== "string") return "/";
  if (
    !volver.startsWith("/") ||
    volver.startsWith("//") ||
    volver.startsWith("/\\")
  )
    return "/";
  if (volver.startsWith("/entrar")) return "/";
  return volver;
}
