"use client";

import { X } from "lucide-react";
import { ESTADOS_ACTIVOS, type EstadoCita } from "../lib/estados";
import type { ProfesionalAgenda } from "../types";
import { etiquetaEstados } from "./panel-filtros";
import { AvatarProfesional } from "./piezas";

const FICHA =
  "inline-flex h-9 items-center gap-2 rounded-full border border-ac-borde bg-ac-papel pl-1.5 pr-2 text-[13px] md:h-10";

const esActivas = (e: EstadoCita[]) =>
  e.length === ESTADOS_ACTIVOS.length && !e.includes("cancelado");

/** Pastillas con lo filtrado; la × quita el filtro. */
export function FichasFiltro({
  profesional,
  fijo,
  estados,
  onQuitarProfesional,
  onQuitarEstados,
}: {
  profesional: ProfesionalAgenda | null;
  fijo: boolean;
  estados: EstadoCita[];
  onQuitarProfesional: () => void;
  onQuitarEstados: () => void;
}) {
  if (!profesional && esActivas(estados)) return null;
  return (
    <div className="flex flex-wrap gap-2 border-b border-ac-borde bg-ac-papel px-3 py-2 print:hidden">
      {profesional ? (
        <span className={FICHA}>
          <AvatarProfesional profesional={profesional} tamano={26} />
          {profesional.nombre}
          {fijo ? null : (
            <button
              type="button"
              aria-label={`Quitar filtro ${profesional.nombre}`}
              onClick={onQuitarProfesional}
              className="area-tactil rounded-full p-0.5 hover:bg-ac-niebla"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </span>
      ) : null}
      {esActivas(estados) ? null : (
        <span className={`${FICHA} pl-3`}>
          {etiquetaEstados(estados)}
          <button
            type="button"
            aria-label="Volver a reservas activas"
            onClick={onQuitarEstados}
            className="area-tactil rounded-full p-0.5 hover:bg-ac-niebla"
          >
            <X className="h-4 w-4" />
          </button>
        </span>
      )}
    </div>
  );
}
