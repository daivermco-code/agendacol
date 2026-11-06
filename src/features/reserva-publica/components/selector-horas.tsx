"use client";

import { CalendarX2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  DIAS_ADELANTE,
  diaCorto,
  mesAnio,
  sumarDias,
} from "../lib/fechas-publicas";
import { agruparHoras } from "../lib/seleccion";
import type { DiaLibre } from "../types";

interface Props {
  dias: DiaLibre[];
  desde: string;
  hoy: string;
  fecha: string | null;
  hora: string | null;
  cargando: boolean;
  /** Hasta cuántos días adelante se reserva (Ajustes → Sitio web). */
  diasMax?: number;
  onMover: (desde: string) => void;
  onFecha: (fecha: string) => void;
  onHora: (hora: string) => void;
}

const GRUPOS = [
  ["manana", "Mañana"],
  ["tarde", "Tarde"],
  ["noche", "Noche"],
] as const;

/** Tira de 7 días con flechas (los cerrados apagados) y las horas libres en Mañana, Tarde y Noche. */
export function SelectorHoras({
  dias,
  desde,
  hoy,
  fecha,
  hora,
  cargando,
  diasMax = DIAS_ADELANTE,
  onMover,
  onFecha,
  onHora,
}: Props) {
  const elegido = dias.find((d) => d.fecha === fecha) ?? null;
  const siguienteConHoras = dias.find(
    (d) => d.fecha > (fecha ?? "") && d.horas.length > 0,
  );
  const puedeAtras = desde > hoy;
  const puedeAdelante = sumarDias(desde, 7) <= sumarDias(hoy, diasMax);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="font-semibold">{mesAnio(fecha ?? desde)}</p>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="md:h-8 md:w-8"
            onClick={() => onMover(sumarDias(desde, -7))}
            disabled={!puedeAtras || cargando}
            aria-label="Semana anterior"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="md:h-8 md:w-8"
            onClick={() => onMover(sumarDias(desde, 7))}
            disabled={!puedeAdelante || cargando}
            aria-label="Semana siguiente"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div
        className="grid grid-cols-7 gap-0.5 md:gap-1.5"
        role="group"
        aria-label="Días"
      >
        {dias.map((d) => {
          const { semana, numero } = diaCorto(d.fecha);
          const activo = d.fecha === fecha;
          return (
            <button
              key={d.fecha}
              type="button"
              disabled={!d.abierto || cargando}
              onClick={() => onFecha(d.fecha)}
              aria-pressed={activo}
              aria-label={`${semana} ${numero}${!d.abierto ? ", cerrado" : d.horas.length ? "" : ", sin horas libres"}`}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-md border py-2 text-sm transition-colors",
                activo
                  ? "border-ac-laguna bg-ac-laguna text-ac-papel"
                  : "border-ac-borde bg-ac-papel hover:border-ac-laguna hover:bg-ac-laguna-claro",
                !d.abierto &&
                  "cursor-not-allowed border-transparent bg-ac-niebla-oscura text-ac-neblina line-through hover:border-transparent hover:bg-ac-niebla-oscura",
                d.abierto && !d.horas.length && !activo && "text-ac-neblina",
              )}
            >
              <span className="text-xs">{semana}</span>
              <span className="text-base font-semibold tabular-nums">
                {numero}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "h-1 w-1 rounded-full",
                  d.horas.length
                    ? activo
                      ? "bg-ac-papel"
                      : "bg-ac-laguna"
                    : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-5 min-h-40" aria-live="polite" aria-busy={cargando}>
        {cargando ? (
          <p className="flex items-center gap-2 text-ac-pizarra">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Buscando horas libres…
          </p>
        ) : !elegido ? (
          <p className="text-ac-pizarra">
            Elige un día para ver las horas libres.
          </p>
        ) : !elegido.horas.length ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-ac-borde-fuerte bg-ac-papel p-4">
            <p className="flex items-center gap-2">
              <CalendarX2
                className="h-4 w-4 text-ac-pizarra"
                aria-hidden="true"
              />
              No hay horas libres este día. Prueba otro.
            </p>
            {siguienteConHoras ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onFecha(siguienteConHoras.fecha)}
              >
                Ver el siguiente día con horas
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            {GRUPOS.map(([clave, nombre]) => {
              const horas = agruparHoras(elegido.horas)[clave];
              if (!horas.length) return null;
              return (
                <fieldset key={clave}>
                  <legend className="mb-2 text-sm font-semibold text-ac-pizarra">
                    {nombre}
                  </legend>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {horas.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => onHora(h)}
                        aria-pressed={h === hora}
                        className={cn(
                          "rounded-md border py-2 text-sm font-medium tabular-nums min-h-11 md:min-h-0 transition-colors",
                          h === hora
                            ? "border-ac-laguna bg-ac-laguna text-ac-papel"
                            : "border-ac-borde bg-ac-papel hover:border-ac-laguna hover:bg-ac-laguna-claro",
                        )}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </fieldset>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
