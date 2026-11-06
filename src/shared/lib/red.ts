/**
 * La red caída (Fase 11): reconocer el error de un pedido que no salió y los textos que se muestran. Con la app
 * abierta se sigue viendo lo cargado; nada se guarda sin red.
 */

export const SIN_RED_NO_GUARDO =
  "Sin conexión: no se guardó. Inténtalo cuando vuelva la red";
export const SIN_RED_PANTALLA = "Sin conexión: esta pantalla necesita internet";

// Chrome y Edge, Safari, Firefox y React Native: lo que dice `fetch` cuando el pedido no llega a salir.
const MARCAS = [
  "Failed to fetch",
  "Load failed",
  "NetworkError",
  "Network request failed",
];

/** true si el error es de un pedido que no llegó al servidor (sin red), no de algo que el servidor rechazó. */
export function esErrorDeRed(e: unknown): boolean {
  const mensaje =
    typeof e === "string"
      ? e
      : e && typeof e === "object" && "message" in e
        ? (e as { message: unknown }).message
        : null;
  return typeof mensaje === "string" && MARCAS.some((m) => mensaje.includes(m));
}

/** El texto para un aviso de error: el de la red si fue la red; si no, el del error (o `otro`). */
export function mensajeDeError(
  e: unknown,
  otro = "Algo falló. Inténtalo de nuevo",
): string {
  if (esErrorDeRed(e)) return SIN_RED_NO_GUARDO;
  return e instanceof Error && e.message ? e.message : otro;
}
