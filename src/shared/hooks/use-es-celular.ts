"use client";

import { useSyncExternalStore } from "react";

const CELULAR = "(max-width: 767px)";

function suscribir(avisar: () => void) {
  const m = window.matchMedia(CELULAR);
  m.addEventListener("change", avisar);
  return () => m.removeEventListener("change", avisar);
}

/**
 * true por debajo de 768 px. Celular primero (DESIGN.md §5): en el servidor y al hidratar vale `true`, así en el
 * celular nada salta al cargar; en tableta y computador se corrige en cuanto el navegador responde.
 */
export function useEsCelular(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => window.matchMedia(CELULAR).matches,
    () => true,
  );
}
