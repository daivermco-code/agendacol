"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { columnasElegidas, type ColumnaListado } from "@/shared/lib/csv";

const EVENTO = "agedacol-columnas";

function leer(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave);
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
 * Las columnas que este navegador eligió ver en un listado (se recuerdan aquí, no en la cuenta). Si el navegador no
 * deja guardar, o en el servidor, salen las de siempre.
 */
export function useColumnas<T extends ColumnaListado>(
  listado: string,
  todas: readonly T[],
) {
  const clave = `agedacol:columnas:${listado}`;
  const guardado = useSyncExternalStore(
    suscribir,
    () => leer(clave),
    () => null,
  );
  const visibles = useMemo(() => {
    let pedidas: string[] | null = null;
    try {
      const v: unknown = guardado ? JSON.parse(guardado) : null;
      if (Array.isArray(v))
        pedidas = v.filter((x): x is string => typeof x === "string");
    } catch {
      pedidas = null;
    }
    return columnasElegidas(todas, pedidas);
  }, [guardado, todas]);

  const cambiar = useCallback(
    (claves: string[]) => {
      try {
        window.localStorage.setItem(clave, JSON.stringify(claves));
      } catch {
        // Sin almacenamiento: el cambio no se recuerda.
      }
      window.dispatchEvent(new Event(EVENTO));
    },
    [clave],
  );

  const ver = useCallback(
    (c: string) => visibles.some((v) => v.clave === c),
    [visibles],
  );
  return { visibles, ver, cambiar };
}
