"use client";

import { useSyncExternalStore } from "react";

export interface EstadoConexion {
  enLinea: boolean;
  /** Cuándo se fue la red (ms): lo que se ve en pantalla es de esa hora. */
  desde: number | null;
}

/** Lo que la conexión necesita del navegador; en las pruebas se cambia por uno de mentiras. */
export interface Entorno {
  enLinea: () => boolean;
  escuchar: (tipo: "online" | "offline", fn: () => void) => () => void;
  /** ¿Responde el servidor? (`online` solo dice que hay una red, no que llegue). */
  comprobar: () => Promise<boolean>;
  ahora: () => number;
  esperar: (fn: () => void, ms: number) => () => void;
}

export const REINTENTO_MS = 5_000;
const EN_LINEA: EstadoConexion = { enLinea: true, desde: null };

/**
 * Estado de la red para toda la app (T-11.3): `offline` la da por caída al instante; `online` la da por vuelta solo
 * cuando el servidor responde, y si no, reintenta cada 5 s. Escucha mientras haya alguien suscrito.
 */
export function crearConexion(entorno: Entorno) {
  let estado = EN_LINEA;
  const oyentes = new Set<() => void>();
  let soltar: (() => void)[] = [];
  let reintento: (() => void) | null = null;
  // Cada caída o comprobación nueva deja sin efecto la comprobación que iba en camino.
  let vuelta = 0;

  const poner = (e: EstadoConexion) => {
    estado = e;
    oyentes.forEach((o) => o());
  };
  const cancelarReintento = () => {
    reintento?.();
    reintento = null;
  };
  const caida = () => {
    vuelta += 1;
    cancelarReintento();
    if (estado.enLinea) poner({ enLinea: false, desde: entorno.ahora() });
  };
  const confirmar = async () => {
    const mia = (vuelta += 1);
    cancelarReintento();
    const ok = await entorno.comprobar();
    if (mia !== vuelta) return;
    if (ok) {
      if (!estado.enLinea) poner(EN_LINEA);
    } else reintento = entorno.esperar(() => void confirmar(), REINTENTO_MS);
  };

  function arrancar() {
    if (!entorno.enLinea()) caida();
    else if (!estado.enLinea) void confirmar();
    soltar = [
      entorno.escuchar("offline", caida),
      entorno.escuchar("online", () => void confirmar()),
    ];
  }
  function parar() {
    soltar.forEach((s) => s());
    soltar = [];
    cancelarReintento();
    vuelta += 1;
  }

  return {
    leer: () => estado,
    suscribir(o: () => void) {
      if (oyentes.size === 0) arrancar();
      oyentes.add(o);
      return () => {
        oyentes.delete(o);
        if (oyentes.size === 0) parar();
      };
    },
  };
}

const NAVEGADOR: Entorno = {
  enLinea: () => navigator.onLine,
  escuchar: (tipo, fn) => {
    window.addEventListener(tipo, fn);
    return () => window.removeEventListener(tipo, fn);
  },
  // El manifiesto es público y pequeño (el proxy no lo toca); `no-store` para no leerlo del caché.
  comprobar: async () => {
    try {
      const r = await fetch("/manifest.webmanifest", {
        method: "HEAD",
        cache: "no-store",
      });
      return r.ok;
    } catch {
      return false;
    }
  },
  ahora: () => Date.now(),
  esperar: (fn, ms) => {
    const id = window.setTimeout(fn, ms);
    return () => window.clearTimeout(id);
  },
};

let unica: ReturnType<typeof crearConexion> | null = null;
const conexion = () => (unica ??= crearConexion(NAVEGADOR));
const nada = () => () => {};

/** Si hay red y desde cuándo no. En el servidor y al hidratar, siempre en línea. */
export function useConexion(): EstadoConexion {
  return useSyncExternalStore(
    typeof window === "undefined" ? nada : (o) => conexion().suscribir(o),
    () => conexion().leer(),
    () => EN_LINEA,
  );
}
