"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Fecha (ISO) del aviso más nuevo que ya se vio en este equipo. */
export const CLAVE_VISTO = "agedacol-avisos-visto";
const EVENTO = "agedacol-avisos-visto";

function leer(): string | null {
  try {
    return window.localStorage.getItem(CLAVE_VISTO);
  } catch {
    return null;
  }
}

function suscribir(aviso: () => void) {
  window.addEventListener("storage", aviso);
  window.addEventListener(EVENTO, aviso);
  return () => {
    window.removeEventListener("storage", aviso);
    window.removeEventListener(EVENTO, aviso);
  };
}

/**
 * Hasta dónde se leyeron los avisos (T-12.10). Se recuerda en el equipo, no en la cuenta. `listo` es false en el
 * servidor y en la primera pintada, para no marcar nada como nuevo antes de saber.
 */
export function useVisto() {
  const visto = useSyncExternalStore(suscribir, leer, () => null);
  const listo = useSyncExternalStore(
    suscribir,
    () => true,
    () => false,
  );
  const marcar = useCallback((fecha: string) => {
    try {
      const antes = window.localStorage.getItem(CLAVE_VISTO);
      // Nunca hacia atrás: otra pestaña pudo haber visto algo más nuevo.
      if (antes && new Date(antes).getTime() >= new Date(fecha).getTime())
        return;
      window.localStorage.setItem(CLAVE_VISTO, fecha);
    } catch {
      return;
    }
    window.dispatchEvent(new Event(EVENTO));
  }, []);
  return { visto, listo, marcar };
}
