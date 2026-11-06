"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Miembro } from "@/features/auth/services/miembro";
import { puede, type Accion } from "@/shared/lib/permisos";

const ContextoMiembro = createContext<Miembro | null>(null);

export function ProveedorMiembro({
  miembro,
  children,
}: {
  miembro: Miembro;
  children: ReactNode;
}) {
  return (
    <ContextoMiembro.Provider value={miembro}>
      {children}
    </ContextoMiembro.Provider>
  );
}

export function useMiembro(): Miembro {
  const miembro = useContext(ContextoMiembro);
  if (!miembro)
    throw new Error("useMiembro se usa dentro del layout de la app");
  return miembro;
}

/** Para ocultar botones: `const puedo = usePuede(); puedo("cobrar")`. */
export function usePuede(): (accion: Accion) => boolean {
  const { rol } = useMiembro();
  return (accion) => puede(rol, accion);
}
