"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Desde la tableta, `/ajustes` sigue llevando a Mi negocio: el centro es solo del celular. */
export function IrAMiNegocio() {
  const router = useRouter();
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) {
      router.replace("/ajustes/mi-negocio");
    }
  }, [router]);
  return null;
}
