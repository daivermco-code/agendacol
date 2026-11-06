"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export const POR_PAGINA = [25, 50, 100] as const;

/** "Anterior 1 2 3 Siguiente" + filas por página (25/50/100). Las páginas del medio se acortan con "…". */
export function Paginacion({
  pagina,
  total,
  porPagina,
  onPagina,
  onPorPagina,
}: {
  pagina: number;
  total: number;
  porPagina: number;
  onPagina: (p: number) => void;
  /** Sin esta función no se muestra el selector de filas por página. */
  onPorPagina?: (n: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const visibles = [...new Set([1, pagina - 1, pagina, pagina + 1, paginas])]
    .filter((p) => p >= 1 && p <= paginas)
    .sort((a, b) => a - b);
  const boton =
    "inline-flex h-11 min-w-11 md:h-8 md:min-w-8 items-center justify-center gap-1 rounded-md px-2 text-sm disabled:text-ac-neblina";
  return (
    <nav
      aria-label="Paginación"
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-4"
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={cn(boton, "hover:bg-ac-niebla")}
          disabled={pagina <= 1}
          onClick={() => onPagina(pagina - 1)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Anterior
        </button>
        {visibles.map((p, i) => (
          <span key={p} className="flex items-center">
            {i > 0 && p - visibles[i - 1] > 1 ? (
              <span className="px-1 text-ac-neblina">…</span>
            ) : null}
            <button
              type="button"
              aria-current={p === pagina ? "page" : undefined}
              aria-label={`Página ${p}`}
              className={cn(
                boton,
                "cifras",
                p === pagina
                  ? "border-b-2 border-ac-laguna font-semibold text-ac-laguna-hondo"
                  : "hover:bg-ac-niebla",
              )}
              onClick={() => onPagina(p)}
            >
              {p}
            </button>
          </span>
        ))}
        <button
          type="button"
          className={cn(boton, "hover:bg-ac-niebla")}
          disabled={pagina >= paginas}
          onClick={() => onPagina(pagina + 1)}
        >
          Siguiente <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {onPorPagina ? (
        <label className="flex items-center gap-2 text-sm">
          <select
            aria-label="Filas por página"
            value={porPagina}
            onChange={(e) => onPorPagina(Number(e.target.value))}
            className="h-11 md:h-8 rounded-md border border-ac-borde bg-ac-papel px-2 text-sm"
          >
            {POR_PAGINA.map((n) => (
              <option key={n} value={n}>
                {n} por página
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </nav>
  );
}
