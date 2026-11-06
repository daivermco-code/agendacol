"use client";

import { cn } from "@/shared/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  ESTADOS,
  ESTADOS_ACTIVOS,
  type EstadoCita,
} from "@/features/agenda/lib/estados";

function Punto({
  estado,
  className,
}: {
  estado: EstadoCita;
  className?: string;
}) {
  const c = ESTADOS[estado];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2",
        className,
      )}
      style={{ background: c.fondo, borderColor: c.borde }}
    />
  );
}

/** Desplegable del estado arriba a la derecha de la ventana de reserva. */
export function SelectorEstado({
  valor,
  onCambio,
}: {
  valor: EstadoCita;
  onCambio: (e: EstadoCita) => void;
}) {
  return (
    <Select value={valor} onValueChange={(v) => onCambio(v as EstadoCita)}>
      <SelectTrigger
        aria-label="Estado de la reserva"
        className="md:h-8 w-[150px] rounded-full"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ESTADOS_ACTIVOS.map((e) => (
          <SelectItem key={e} value={e}>
            <span className="flex items-center gap-2">
              <Punto estado={e} /> {ESTADOS[e].nombre}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Los 6 estados de la ficha. Desde la tableta, puntos: el actual se agranda con su nombre. En el celular, fichas
 * con punto y nombre en una fila que se desliza. Un toque cambia el estado.
 */
export function PuntosEstado({
  actual,
  deshabilitado,
  onCambio,
}: {
  actual: EstadoCita;
  deshabilitado?: boolean;
  onCambio: (e: EstadoCita) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Cambiar estado"
      className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] md:flex-wrap md:gap-1.5 md:overflow-visible"
    >
      {ESTADOS_ACTIVOS.map((e) => {
        const c = ESTADOS[e];
        const es = e === actual;
        // En celular el botón mide 44 px y el punto de color sigue igual adentro.
        return (
          <button
            key={e}
            type="button"
            disabled={deshabilitado}
            aria-pressed={es}
            aria-label={es ? `Estado: ${c.nombre}` : `Cambiar a ${c.nombre}`}
            title={c.nombre}
            onClick={() => !es && onCambio(e)}
            className="group inline-flex h-11 shrink-0 items-center justify-center rounded-full disabled:opacity-60 md:h-auto"
          >
            <span
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] md:hidden",
                es
                  ? "font-semibold"
                  : "border-ac-borde bg-ac-papel text-ac-tinta",
              )}
              style={
                es
                  ? {
                      background: c.fondo,
                      borderColor: c.borde,
                      color: c.texto,
                    }
                  : undefined
              }
            >
              <Punto estado={e} />
              {c.nombre}
            </span>
            <span
              className={cn(
                "hidden items-center gap-1.5 rounded-full border-2 transition-all md:inline-flex",
                es
                  ? "h-7 px-2.5 text-[12px] font-semibold"
                  : "h-5 w-5 group-hover:scale-110",
              )}
              style={{
                background: c.fondo,
                borderColor: c.borde,
                color: c.texto,
              }}
            >
              {es ? c.nombre : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
