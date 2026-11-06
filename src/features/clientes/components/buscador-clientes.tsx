"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Search } from "lucide-react";
import { cn, iniciales } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { buscarClientes } from "../actions";
import type { ClienteResumen } from "../schemas";

export function useRetrasado(valor: string, ms = 250): string {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const id = window.setTimeout(() => setV(valor), ms);
    return () => window.clearTimeout(id);
  }, [valor, ms]);
  return v;
}

/** Buscador de clientes por nombre, documento, correo o teléfono, con "+ Nuevo cliente" al lado. */
export function BuscadorClientes({
  id,
  invalido,
  onElegir,
  onNuevo,
}: {
  id: string;
  invalido?: boolean;
  onElegir: (c: ClienteResumen) => void;
  onNuevo: (texto: string) => void;
}) {
  const lista = useId();
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  // Cierre diferido al perder el foco; se anula si el foco vuelve (la ventana lo devuelve al abrirse).
  const cierre = useRef<number | undefined>(undefined);
  const abrir = () => {
    window.clearTimeout(cierre.current);
    setAbierto(true);
  };
  const buscado = useRetrasado(texto.trim());
  const consulta = useQuery({
    queryKey: ["clientes-busqueda", buscado],
    queryFn: () => buscarClientes(buscado),
    enabled: buscado.length >= 2,
    staleTime: 30_000,
  });
  const resultados = buscado.length >= 2 ? (consulta.data ?? []) : [];
  const mostrar = abierto && texto.trim().length >= 2;

  function elegir(c: ClienteResumen) {
    onElegir(c);
    setTexto("");
    setAbierto(false);
  }

  return (
    <div className="flex items-start gap-2">
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-ac-neblina"
          aria-hidden="true"
        />
        <Input
          id={id}
          role="combobox"
          aria-expanded={mostrar}
          aria-controls={lista}
          aria-autocomplete="list"
          aria-invalid={invalido || undefined}
          aria-activedescendant={
            mostrar && resultados[activo] ? `${lista}-${activo}` : undefined
          }
          autoComplete="off"
          placeholder="Busca por nombre, documento, correo o teléfono"
          className="pl-8"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            abrir();
            setActivo(0);
          }}
          onFocus={abrir}
          onBlur={() => {
            cierre.current = window.setTimeout(() => setAbierto(false), 150);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActivo((a) => Math.min(a + 1, resultados.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActivo((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && mostrar && resultados[activo]) {
              e.preventDefault();
              elegir(resultados[activo]);
            } else if (e.key === "Escape" && mostrar) {
              e.stopPropagation();
              setAbierto(false);
            }
          }}
        />
        {mostrar ? (
          <ul
            id={lista}
            role="listbox"
            aria-label="Clientes encontrados"
            className="mt-1 max-h-56 overflow-y-auto rounded-md border border-ac-borde bg-ac-papel py-1 shadow-flota"
          >
            {resultados.map((c, i) => (
              <li
                key={c.id}
                id={`${lista}-${i}`}
                role="option"
                aria-selected={i === activo}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(c)}
                onMouseEnter={() => setActivo(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm",
                  i === activo && "bg-ac-niebla",
                )}
              >
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ac-laguna-claro text-[11px] font-bold text-ac-laguna-hondo">
                  {iniciales(c.nombre, c.apellido)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {c.nombre} {c.apellido}
                  </span>
                  <span className="block truncate text-xs text-ac-pizarra">
                    {[c.correo, c.telefono, c.documento]
                      .filter(Boolean)
                      .join(" · ") || "Sin contacto"}
                  </span>
                </span>
              </li>
            ))}
            {consulta.isFetching ? (
              <li className="flex items-center gap-2 px-3 py-2 text-sm text-ac-pizarra">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{" "}
                Buscando…
              </li>
            ) : resultados.length === 0 ? (
              <li className="px-3 py-2 text-sm text-ac-pizarra">
                No hay clientes con «{texto.trim()}».
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => onNuevo(texto.trim())}
        className="shrink-0"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />{" "}
        <span className="sr-only md:not-sr-only md:whitespace-nowrap">
          Nuevo cliente
        </span>
      </Button>
    </div>
  );
}
