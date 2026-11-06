"use client";

import { Ban, Users } from "lucide-react";
import { Hoja } from "@/shared/components/hoja";
import { cn } from "@/shared/lib/utils";
import type { ColumnaGrid } from "../lib/columnas";
import { ESTADOS } from "../lib/estados";
import { aHora } from "../lib/fechas";
import type { CitaAgenda } from "../types";
import { COLOR_CLASE } from "./piezas";

interface Props {
  /** "jue 5 nov · 10:30" */
  titulo: string;
  /** Ids del reparto: la cita tal cual, "b:<id>" un bloqueo, "k:<id>" una clase. */
  ids: string[];
  col: ColumnaGrid;
  colores: Map<string, { color: string; nombre: string }> | null;
  onCerrar: () => void;
  onCita?: (cita: CitaAgenda, el: HTMLElement) => void;
  onBloqueo?: (bloqueoId: string) => void;
  onClase: (id: string, el: HTMLElement) => void;
}

const FILA =
  "flex min-h-14 w-full flex-col justify-center rounded-2xl border-l-4 px-4 py-2 text-left";

/**
 * Hoja del "+N más" (celular, T-12.6): lo que no cabe en los carriles de la columna, en tarjetas anchas que
 * abren la cita, la clase o el bloqueo.
 */
export function HojaMas(p: Props) {
  const citas = p.col.citas.filter((c) => p.ids.includes(c.id));
  const clases = p.col.clases.filter((k) => p.ids.includes(`k:${k.id}`));
  const bloqueos = p.col.bloqueos.filter((b) => p.ids.includes(`b:${b.id}`));
  // La ficha se abre después de cerrar la hoja, para que el foco no vuelva a un botón que ya no está.
  const luego = (accion: () => void) => {
    p.onCerrar();
    accion();
  };

  return (
    <Hoja
      abierta
      onCambiar={(v) => !v && p.onCerrar()}
      titulo={`${p.ids.length} más`}
      descripcion={p.titulo}
    >
      <p className="cifras -mt-1 mb-3 text-[13px] text-ac-pizarra">
        {p.titulo}
      </p>
      <ul className="space-y-2">
        {citas
          .sort((a, b) => a.inicio - b.inicio)
          .map((c) => {
            const color = ESTADOS[c.estado];
            const prof = p.colores?.get(c.profesionalId)?.nombre;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  aria-label={`Ver la cita de ${c.clienteNombre}, ${c.servicioNombre}, ${aHora(c.inicio)}, ${color.nombre}`}
                  className={FILA}
                  style={{
                    background: color.fondo,
                    borderLeftColor: color.borde,
                    color: color.texto,
                  }}
                  onClick={(e) => {
                    const el = e.currentTarget;
                    luego(() => p.onCita?.(c, el));
                  }}
                >
                  <span className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="cifras">
                      {aHora(c.inicio)} – {aHora(c.fin)}
                    </span>
                    <span className="font-semibold">{color.nombre}</span>
                  </span>
                  <span
                    className={cn(
                      "truncate text-[15px] font-semibold",
                      c.estado === "cancelado" && "line-through",
                    )}
                  >
                    {c.clienteNombre}
                  </span>
                  <span className="truncate text-[13px]">
                    {c.servicioNombre}
                    {prof ? ` · ${prof}` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        {clases.map((k) => (
          <li key={k.id}>
            <button
              type="button"
              className={FILA}
              style={{
                background: COLOR_CLASE.fondo,
                borderLeftColor: COLOR_CLASE.borde,
                color: COLOR_CLASE.texto,
              }}
              onClick={(e) => {
                const el = e.currentTarget;
                luego(() => p.onClase(k.id, el));
              }}
            >
              <span className="cifras text-[13px]">
                {aHora(k.inicio)} – {aHora(k.fin)}
              </span>
              <span className="flex items-center gap-1 text-[15px] font-semibold">
                <Users className="h-4 w-4" aria-hidden="true" />
                {k.servicioNombre}
              </span>
            </button>
          </li>
        ))}
        {bloqueos.map((b) => (
          <li key={b.id}>
            <button
              type="button"
              disabled={!p.onBloqueo}
              className={cn(
                FILA,
                "border-ac-borde-fuerte bg-ac-niebla-oscura text-ac-pizarra",
              )}
              onClick={() => luego(() => p.onBloqueo?.(b.id))}
            >
              <span className="cifras text-[13px]">
                {aHora(b.inicio)} – {aHora(b.fin)}
              </span>
              <span className="flex items-center gap-1 text-[15px] font-semibold">
                <Ban className="h-4 w-4" aria-hidden="true" />
                {b.motivo || "Bloqueado"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Hoja>
  );
}
