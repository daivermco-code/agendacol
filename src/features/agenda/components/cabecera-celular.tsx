"use client";

import { useState } from "react";
import {
  CalendarDays,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns3,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Store,
  type LucideIcon,
} from "lucide-react";
import { Hoja } from "@/shared/components/hoja";
import { cn } from "@/shared/lib/utils";
import type { Vista } from "../lib/fechas";
import {
  Actualizado,
  type ControlesAgenda,
  Leyenda,
  SelectorBloque,
  VISTAS_CELULAR,
} from "./controles-agenda";

const ICONO_VISTA: Record<Vista, LucideIcon> = {
  lista: List,
  dia: CalendarDays,
  "3dias": Columns3,
  semana: CalendarRange,
  mes: LayoutGrid,
};

const ICONO =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ac-tinta hover:bg-ac-niebla";

/**
 * Cabecera de la agenda en el celular (T-12.5): filtros, la fecha como título ("jue 5 nov") entre flechas y el
 * ícono de la vista, que abre una hoja con las 5 vistas y las opciones (bloque, leyenda, recargar).
 */
export function CabeceraCelular(
  c: ControlesAgenda & {
    tituloCorto: string;
    onAbrirPanel: () => void;
    busqueda: string;
    onBusqueda: (texto: string) => void;
    /** Citas que se ven con la búsqueda puesta. */
    encontradas: number;
    /** Sin lupa (vista Ahora). */
    sinBusqueda?: boolean;
  },
) {
  const [hoja, setHoja] = useState(false);
  const [buscando, setBuscando] = useState(false);
  if (c.sinBusqueda && buscando) setBuscando(false);
  const cerrarBusqueda = () => {
    c.onBusqueda("");
    setBuscando(false);
  };
  const IconoVista = ICONO_VISTA[c.vista];
  const elegir = (v: Vista) => {
    c.onVista(v);
    setHoja(false);
  };

  return (
    <div className="border-b border-ac-borde bg-ac-papel">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button
          type="button"
          aria-label="Abrir filtros"
          className={ICONO}
          onClick={c.onAbrirPanel}
        >
          <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Anterior"
          className={ICONO}
          onClick={() => c.onMover(-1)}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1 text-center leading-tight">
          <p className="truncate text-[17px] font-bold">{c.tituloCorto}</p>
          <p className="flex items-center justify-center gap-1 truncate text-[12px] text-ac-pizarra">
            <Store className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{c.subtitulo}</span>
          </p>
        </div>
        <button
          type="button"
          aria-label="Siguiente"
          className={ICONO}
          onClick={() => c.onMover(1)}
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Buscar en la agenda"
          aria-expanded={buscando}
          className={cn(
            ICONO,
            buscando && "bg-ac-laguna-claro text-ac-laguna-hondo",
            c.sinBusqueda && "invisible",
          )}
          disabled={c.sinBusqueda}
          onClick={() => (buscando ? cerrarBusqueda() : setBuscando(true))}
        >
          <Search className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Vista y opciones"
          aria-haspopup="dialog"
          className={ICONO}
          onClick={() => setHoja(true)}
        >
          <IconoVista className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      {buscando ? (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2">
            <input
              type="search"
              autoFocus
              aria-label="Buscar citas"
              placeholder="Cliente, servicio o teléfono"
              value={c.busqueda}
              onChange={(e) => c.onBusqueda(e.target.value)}
              className="h-11 min-w-0 flex-1 rounded-full border border-ac-borde bg-ac-niebla px-4 text-[15px] outline-none focus-visible:border-ac-foco"
            />
            <button
              type="button"
              onClick={cerrarBusqueda}
              className="h-11 shrink-0 px-2 text-[15px] font-semibold text-ac-laguna"
            >
              Cancelar
            </button>
          </div>
          {/* Montada desde que se abre la búsqueda, para que el lector de pantalla anuncie el primer resultado. */}
          <p className="mt-1 px-1 text-[12px] text-ac-pizarra" role="status">
            {!c.busqueda.trim()
              ? ""
              : c.encontradas === 1
                ? "1 cita en estas fechas"
                : `${c.encontradas} citas en estas fechas`}
          </p>
        </div>
      ) : null}

      <Hoja abierta={hoja} onCambiar={setHoja} titulo="Vista">
        <ul className="-mx-2" aria-label="Vistas">
          {VISTAS_CELULAR.map((v) => {
            const Icono = ICONO_VISTA[v.valor];
            const actual = v.valor === c.vista;
            return (
              <li key={v.valor}>
                <button
                  type="button"
                  aria-pressed={actual}
                  onClick={() => elegir(v.valor)}
                  className={cn(
                    "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium hover:bg-ac-niebla",
                    actual && "bg-ac-laguna-claro text-ac-laguna-hondo",
                  )}
                >
                  <Icono className="h-5 w-5" aria-hidden="true" />
                  <span className="flex-1">{v.nombre}</span>
                  {actual ? (
                    <Check className="h-5 w-5" aria-hidden="true" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ac-borde pt-4">
          <SelectorBloque bloque={c.bloque} onBloque={c.onBloque} />
          <button
            type="button"
            aria-label="Recargar"
            className={cn(ICONO, "border border-ac-borde text-ac-pizarra")}
            onClick={c.onRecargar}
          >
            <RefreshCw
              className={cn("h-4 w-4", c.recargando && "animate-spin")}
            />
          </button>
          <Leyenda />
          <Actualizado
            hace={c.hace}
            enVivo={c.enVivo}
            className="inline-flex w-full"
          />
        </div>
      </Hoja>
    </div>
  );
}
