"use client";

import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { usePathname, useRouter } from "next/navigation";

type Valor = string | number;

/**
 * Los filtros de un listado viven en la dirección (?desde=…&pagina=…): `ir` cambia uno o varios y vuelve a la
 * página 1, salvo que el cambio diga otra página. Lo que queda igual al valor por defecto no se escribe.
 */
export function useFiltrosUrl<T extends Record<string, Valor>>(
  filtros: T,
  porDefecto: T,
) {
  const router = useRouter();
  const ruta = usePathname();
  const [cargando, iniciar] = useTransicionRed();
  const ir = (cambio: Partial<T>) => {
    const f: Record<string, Valor> = {
      ...filtros,
      ...("pagina" in filtros ? { pagina: 1 } : {}),
      ...cambio,
    };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(f))
      if (v !== porDefecto[k]) p.set(k, String(v));
    const q = p.toString();
    iniciar(() => router.push(q ? `${ruta}?${q}` : ruta, { scroll: false }));
  };
  return { ir, cargando };
}
