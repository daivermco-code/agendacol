import type { NextRequest } from "next/server";
import { nuevoNonce, politicaDeContenido } from "@/shared/lib/csp";
import { actualizarSesion } from "@/shared/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // La CSP va en el pedido (Next saca de ahí el nonce para sus scripts) y en la respuesta (la aplica el navegador).
  const csp = politicaDeContenido(
    nuevoNonce(),
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NODE_ENV === "development",
  );
  request.headers.set("Content-Security-Policy", csp);
  const respuesta = await actualizarSesion(request);
  respuesta.headers.set("Content-Security-Policy", csp);
  return respuesta;
}

export const config = {
  // Todo menos los archivos estáticos que existen y lo que pide la app instalable (manifest, service worker e
  // íconos), que se leen sin sesión. Solo esos: una ruta de la app terminada en .png también lleva la CSP.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico$|manifest.webmanifest$|sw.js$|icon.svg$|apple-icon.png$|iconos/).*)",
  ],
};
