"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { RangoFechas } from "@/shared/components/rango-fechas";
import { pesos } from "@/shared/lib/formato";
import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/input";
import { atajosPeriodo, type Periodo } from "../lib/periodos";

export const SELECTOR =
  "h-11 w-full rounded-md border border-input bg-ac-papel px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring md:h-9";

/** Tarjeta-resumen que filtra el listado al tocarla (Todas · Pagos parciales · Anuladas). */
export function TarjetaFiltro({
  titulo,
  n,
  monto,
  activa,
  tono = "laguna",
  onClick,
}: {
  titulo: string;
  n: number;
  monto: number;
  activa: boolean;
  tono?: "laguna" | "aviso" | "neutro";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onClick}
      className={cn(
        "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg border bg-ac-papel px-4 py-3 text-left shadow-quieta transition-colors hover:bg-ac-niebla sm:block sm:p-4",
        activa ? "border-ac-laguna ring-1 ring-ac-laguna" : "border-ac-borde",
      )}
    >
      <span className="flex items-center gap-2 text-sm text-ac-pizarra">
        <span
          className={cn(
            "h-2.5 w-2.5 rounded-full",
            tono === "laguna" && "bg-ac-laguna",
            tono === "aviso" && "bg-ac-aviso",
            tono === "neutro" && "bg-ac-neblina",
          )}
          aria-hidden="true"
        />
        {titulo}
      </span>
      <span className="cifras row-span-2 block truncate text-lg font-bold sm:mt-1 sm:text-2xl">
        {pesos(monto)}
      </span>
      <span className="cifras text-xs text-ac-pizarra">
        {n} {n === 1 ? "registro" : "registros"}
      </span>
    </button>
  );
}

/** Selector de período con atajos (Hoy, Esta semana, Este mes…). */
export function FiltroPeriodo({
  id,
  valor,
  hoy,
  onCambio,
}: {
  id: string;
  valor: Periodo;
  hoy: string;
  onCambio: (p: Periodo) => void;
}) {
  return (
    <RangoFechas
      id={id}
      valor={valor}
      atajos={atajosPeriodo(hoy)}
      onCambio={(r) => {
        if (r.desde && r.hasta)
          onCambio(r.desde <= r.hasta ? r : { desde: r.hasta, hasta: r.desde });
      }}
    />
  );
}

/** Buscador que aplica el texto tras una pausa al escribir. */
export function CampoBuscar({
  valor,
  etiqueta,
  onBuscar,
}: {
  valor: string;
  etiqueta: string;
  onBuscar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState(valor);
  const primera = useRef(true);
  const ultimo = useRef(onBuscar);
  useEffect(() => {
    ultimo.current = onBuscar;
  });
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      if (texto.trim() !== valor) ultimo.current(texto.trim());
    }, 300);
    return () => window.clearTimeout(t);
  }, [texto, valor]);
  return (
    <label className="relative block">
      <span className="sr-only">{etiqueta}</span>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ac-neblina"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={etiqueta}
        className="pl-9"
      />
    </label>
  );
}

export function Encabezado({
  titulo,
  texto,
  children,
}: {
  titulo: string;
  texto?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Al menos 12rem para el título: si no caben los botones al lado, bajan a la línea siguiente. */}
      <div className="min-w-0 grow basis-48">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-2xl">
          {titulo}
        </h1>
        {texto ? <p className="text-sm text-ac-pizarra">{texto}</p> : null}
      </div>
      {children}
    </div>
  );
}
