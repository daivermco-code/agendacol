"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

const AVISOS: Record<string, string> = {
  "sin-permiso": "No tienes permiso para ver esa sección",
};

/** Muestra el aviso de `?aviso=` (por ejemplo, al rebotar de una sección sin permiso) y limpia la dirección. */
export function AvisoPorParametro() {
  const params = useSearchParams();
  const router = useRouter();
  const ruta = usePathname();
  const aviso = params.get("aviso");

  useEffect(() => {
    if (!aviso) return;
    const texto = AVISOS[aviso];
    if (texto) toast.error(texto, { id: `aviso-${aviso}` });
    const resto = new URLSearchParams(params.toString());
    resto.delete("aviso");
    const query = resto.toString();
    router.replace(query ? `${ruta}?${query}` : ruta, { scroll: false });
  }, [aviso, params, router, ruta]);

  return null;
}
