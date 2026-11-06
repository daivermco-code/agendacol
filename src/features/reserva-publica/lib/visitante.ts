import "server-only";
import { cookies } from "next/headers";

/** Identifica el navegador para los frenos del sitio (no es una sesión ni guarda datos personales). */
export async function claveVisitante(): Promise<string> {
  const jar = await cookies();
  let id = jar.get("ac_visita")?.value;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    id = crypto.randomUUID();
    jar.set("ac_visita", id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return id;
}
