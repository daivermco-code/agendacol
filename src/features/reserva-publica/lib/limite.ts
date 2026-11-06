import "server-only";

/**
 * Freno de reservas por navegador: 5 por minuto. Vive en la memoria del servidor (basta para la demo local);
 * la base tiene su propio freno por negocio y por cliente.
 */
const VENTANA_MS = 60_000;
const MAXIMO = 5;
const intentos = new Map<string, number[]>();

export function dentroDelLimite(clave: string, ahora = Date.now()): boolean {
  const recientes = (intentos.get(clave) ?? []).filter(
    (t) => ahora - t < VENTANA_MS,
  );
  if (recientes.length >= MAXIMO) {
    intentos.set(clave, recientes);
    return false;
  }
  recientes.push(ahora);
  intentos.set(clave, recientes);
  if (intentos.size > 5000) {
    for (const [k, v] of intentos)
      if (v.every((t) => ahora - t >= VENTANA_MS)) intentos.delete(k);
  }
  return true;
}
