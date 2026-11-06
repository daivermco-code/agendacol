import "server-only";
import { obtenerMiembro, type Miembro } from "@/features/auth/services/miembro";
import { puede, type Accion } from "@/shared/lib/permisos";

export type ResultadoAccion<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; datos: T })
  | { ok: false; error: string; code?: "FORBIDDEN" | "VALIDACION" | "BASE" };

/** Para Server Actions: el miembro si puede hacer la acción; si no, `null` (y la acción devuelve FORBIDDEN). */
export async function miembroQuePuede(accion: Accion): Promise<Miembro | null> {
  const miembro = await obtenerMiembro();
  return miembro && puede(miembro.rol, accion) ? miembro : null;
}

export const SIN_PERMISO = { ok: false, error: "No tienes permiso para hacer esto", code: "FORBIDDEN" } as const;

/** Primer mensaje de un error de Zod, listo para mostrar. */
export function primerError(issues: ReadonlyArray<{ message: string }>): {
  ok: false;
  error: string;
  code: "VALIDACION";
} {
  return { ok: false, error: issues[0]?.message ?? "Revisa los datos", code: "VALIDACION" };
}
