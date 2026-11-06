"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/shared/lib/utils";
import { ESTADOS, ORDEN_ESTADOS, type EstadoCita } from "../lib/estados";
import type { CitaAgenda } from "../types";

const CABECERA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Mes en cuadrícula: cuántas citas hay por estado cada día; tocar un día abre su vista Día. */
export function VistaMes({
  dias,
  ancla,
  hoy,
  citas,
  onDia,
}: {
  dias: string[];
  ancla: string;
  hoy: string;
  citas: CitaAgenda[];
  onDia: (fecha: string) => void;
}) {
  const conteo = useMemo(() => {
    const m = new Map<string, Map<EstadoCita, number>>();
    for (const c of citas) {
      const dia = m.get(c.fecha) ?? new Map<EstadoCita, number>();
      dia.set(c.estado, (dia.get(c.estado) ?? 0) + 1);
      m.set(c.fecha, dia);
    }
    return m;
  }, [citas]);
  const mes = ancla.slice(0, 7);
  // Una fila por semana: el lector de pantalla recorre la cuadrícula como tabla.
  const semanas = Array.from({ length: Math.ceil(dias.length / 7) }, (_, i) =>
    dias.slice(i * 7, i * 7 + 7),
  );

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-ac-papel p-2 md:p-3">
      <div
        className="border-l border-t border-ac-borde"
        role="grid"
        aria-label="Mes"
      >
        <div role="row" className="grid grid-cols-7">
          {CABECERA.map((d) => (
            <div
              key={d}
              role="columnheader"
              className="border-b border-r border-ac-borde bg-ac-niebla py-1.5 text-center text-[12px] font-semibold text-ac-pizarra"
            >
              {d}
            </div>
          ))}
        </div>
        {semanas.map((semana) => (
          <div key={semana[0]} role="row" className="grid grid-cols-7">
            {semana.map((fecha) => (
              <DiaMes
                key={fecha}
                fecha={fecha}
                estados={conteo.get(fecha)}
                otroMes={!fecha.startsWith(mes)}
                esHoy={fecha === hoy}
                onDia={onDia}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DiaMes({
  fecha,
  estados,
  otroMes,
  esHoy,
  onDia,
}: {
  fecha: string;
  estados: Map<EstadoCita, number> | undefined;
  otroMes: boolean;
  esHoy: boolean;
  onDia: (fecha: string) => void;
}) {
  const total = estados ? [...estados.values()].reduce((a, b) => a + b, 0) : 0;
  return (
    <button
      type="button"
      role="gridcell"
      onClick={() => onDia(fecha)}
      className={cn(
        "flex min-h-[92px] flex-col items-stretch gap-1 border-b border-r border-ac-borde p-1.5 text-left transition-colors hover:bg-ac-laguna-claro/50 md:min-h-[112px]",
        otroMes && "bg-ac-niebla/60 text-ac-neblina",
      )}
    >
      <span
        className={cn(
          "cifras inline-flex h-6 w-6 items-center justify-center self-start rounded-full text-[13px] font-semibold",
          esHoy && "bg-ac-laguna text-ac-papel",
        )}
      >
        {Number(fecha.slice(8))}
        <span className="sr-only">
          {format(parseISO(fecha), " 'de' MMMM", { locale: es })}
          {total === 0 ? ", sin citas" : ""}
        </span>
      </span>
      {total > 0 ? (
        <span className="text-[12px] text-ac-pizarra">
          <span className="sr-only">, </span>
          {total} citas
        </span>
      ) : null}
      <span className="flex flex-wrap gap-1">
        {ORDEN_ESTADOS.filter((e) => estados?.get(e)).map((e) => (
          <span
            key={e}
            title={ESTADOS[e].nombre}
            className="cifras rounded-[4px] border-l-[3px] px-1 text-[11px] font-semibold leading-[16px]"
            style={{
              background: ESTADOS[e].fondo,
              borderLeftColor: ESTADOS[e].borde,
              color: ESTADOS[e].texto,
            }}
          >
            {estados?.get(e)}
            <span className="sr-only"> {ESTADOS[e].nombre}</span>
          </span>
        ))}
      </span>
    </button>
  );
}
