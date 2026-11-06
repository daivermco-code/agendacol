import { create } from "zustand";
import type { DatosClase } from "../schemas";

/** Qué clase está abierta en la agenda (ficha junto al bloque) y el formulario de crear o editar. */
interface EstadoClases {
  ficha: { id: string; rect: DOMRect } | null;
  formulario: DatosClase | null;
  abrir: (id: string, el: HTMLElement) => void;
  cerrar: () => void;
  editar: (f: DatosClase) => void;
  cerrarFormulario: () => void;
}

export const useClases = create<EstadoClases>()((set) => ({
  ficha: null,
  formulario: null,
  abrir: (id, el) => set({ ficha: { id, rect: el.getBoundingClientRect() } }),
  cerrar: () => set({ ficha: null }),
  editar: (formulario) => set({ formulario, ficha: null }),
  cerrarFormulario: () => set({ formulario: null }),
}));
