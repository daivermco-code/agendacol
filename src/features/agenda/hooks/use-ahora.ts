"use client";

import { useEffect, useState } from "react";
import { ahoraEnZona } from "../lib/fechas";

/** Fecha y minuto actuales en la zona del local; se actualiza cada 30 s. */
export function useAhora(zona: string) {
  const [ahora, setAhora] = useState(() => ahoraEnZona(zona));
  const [zonaVista, setZonaVista] = useState(zona);
  if (zonaVista !== zona) {
    // Cambió el local: se recalcula en el mismo render, sin esperar al reloj.
    setZonaVista(zona);
    setAhora(ahoraEnZona(zona));
  }
  useEffect(() => {
    const id = window.setInterval(() => setAhora(ahoraEnZona(zona)), 30_000);
    return () => window.clearInterval(id);
  }, [zona]);
  return ahora;
}
