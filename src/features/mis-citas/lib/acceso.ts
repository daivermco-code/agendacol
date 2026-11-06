import "server-only";
import { cookies } from "next/headers";

/** Cookie del acceso a "Mis citas" (7 días). Guarda un valor al azar; la base solo tiene su resumen. */
export const COOKIE_ACCESO = "ac_mis_citas";
const VALOR = /^[0-9a-f]{64}$/;

export async function leerAcceso(): Promise<string | null> {
  const valor = (await cookies()).get(COOKIE_ACCESO)?.value;
  return valor && VALOR.test(valor) ? valor : null;
}
