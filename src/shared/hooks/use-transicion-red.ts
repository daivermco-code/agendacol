"use client";

import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import { esErrorDeRed, SIN_RED_NO_GUARDO } from "@/shared/lib/red";

/** Un solo aviso a la vez, aunque fallen varias cosas juntas. */
export function avisarSinRed() {
  toast.error(SIN_RED_NO_GUARDO, { id: "sin-red-no-guardo" });
}

/**
 * `useTransition` para las Server Actions (T-11.4): si la acción no llega al servidor porque no hay red, avisa
 * "Sin conexión: no se guardó" y la pantalla sigue como estaba (con lo escrito), en vez de la pantalla de error.
 * Cualquier otro error sigue su camino.
 */
export function useTransicionRed(): [boolean, (accion: () => unknown) => void] {
  const [pendiente, iniciar] = useTransition();
  const iniciarConRed = useCallback(
    (accion: () => unknown) =>
      iniciar(async () => {
        try {
          await accion();
        } catch (e) {
          if (!esErrorDeRed(e)) throw e;
          avisarSinRed();
        }
      }),
    [],
  );
  return [pendiente, iniciarConRed];
}
