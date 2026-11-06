"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ESTADOS_ACTIVOS, type EstadoCita } from "../lib/estados";
import type { Vista } from "../lib/fechas";

interface PreferenciasAgenda {
  vista: Vista;
  /** Id, TODOS, o null = sin elegir (semana: el primero; día: todos). */
  profesionalId: string | null;
  estados: EstadoCita[];
  plegado: boolean;
  /** null = el largo de los ajustes del negocio. */
  bloqueMin: number | null;
  ajustarColumnas: boolean;
  agrupada: boolean;
  /** null = el primer local. */
  localId: string | null;
  /** Vista día con una columna por recurso en vez de por profesional. */
  porRecursos: boolean;
}

interface EstadoAgenda extends PreferenciasAgenda {
  poner: (cambio: Partial<PreferenciasAgenda>) => void;
}

export const TODOS = "todos";

export const INICIAL: PreferenciasAgenda = {
  vista: "semana",
  profesionalId: null,
  estados: ESTADOS_ACTIVOS,
  plegado: false,
  bloqueMin: null,
  ajustarColumnas: false,
  agrupada: true,
  localId: null,
  porRecursos: false,
};

/** Filtros y vista de la agenda; se recuerdan en este navegador (US-018). */
export const useAgendaStore = create<EstadoAgenda>()(
  persist(
    (set) => ({
      ...INICIAL,
      poner: (cambio) => set(cambio),
    }),
    {
      name: "agedacol-agenda",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({ poner: _poner, ...resto }) => resto,
    },
  ),
);
