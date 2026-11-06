import { create } from "zustand";

/** El evento que Chrome da cuando la app se puede instalar (no está en los tipos del DOM). */
export interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface EstadoInstalar {
  evento: EventoInstalar | null;
  guardar: (evento: EventoInstalar | null) => void;
}

/** Guarda el aviso de instalación para ofrecerlo en el menú del usuario cuando la persona quiera. */
export const useInstalarApp = create<EstadoInstalar>((set) => ({
  evento: null,
  guardar: (evento) => set({ evento }),
}));
