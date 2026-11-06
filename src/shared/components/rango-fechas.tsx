"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarRange, ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

export interface Rango {
  desde: string;
  hasta: string;
}

function corta(f: string, sinAno: boolean) {
  return format(parseISO(f), sinAno ? "d MMM" : "d MMM yyyy", { locale: es });
}

/** Botón "Desde / hasta" que abre dos fechas. `sinAno` para cumpleaños (solo cuenta el día y el mes). */
export function RangoFechas({
  id,
  valor,
  onCambio,
  sinAno,
  atajos,
  className,
}: {
  id: string;
  valor: Rango;
  onCambio: (r: Rango) => void;
  sinAno?: boolean;
  atajos?: { nombre: string; rango: Rango }[];
  className?: string;
}) {
  const texto =
    valor.desde && valor.hasta
      ? `${corta(valor.desde, Boolean(sinAno))} – ${corta(valor.hasta, Boolean(sinAno))}`
      : "Desde / hasta";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className={cn(
            "flex h-11 w-full md:h-9 items-center gap-2 rounded-md border border-input bg-ac-papel px-3 text-left text-sm",
            !valor.desde && "text-ac-neblina",
            className,
          )}
        >
          <CalendarRange
            className="h-4 w-4 shrink-0 text-ac-pizarra"
            aria-hidden="true"
          />
          <span className="cifras min-w-0 flex-1 truncate">{texto}</span>
          <ChevronDown
            className="h-4 w-4 shrink-0 opacity-60"
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 p-3">
        {atajos?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {atajos.map((a) => (
              <Button
                key={a.nombre}
                type="button"
                size="sm"
                variant="outline"
                className="px-2 text-xs md:h-7"
                onClick={() => onCambio(a.rango)}
              >
                {a.nombre}
              </Button>
            ))}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs font-medium text-ac-pizarra">
            Desde
            <Input
              type="date"
              value={valor.desde}
              max={valor.hasta || undefined}
              onChange={(e) => onCambio({ ...valor, desde: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-ac-pizarra">
            Hasta
            <Input
              type="date"
              value={valor.hasta}
              min={valor.desde || undefined}
              onChange={(e) => onCambio({ ...valor, hasta: e.target.value })}
            />
          </label>
        </div>
        {valor.desde || valor.hasta ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="px-2 text-xs md:h-7"
            onClick={() => onCambio({ desde: "", hasta: "" })}
          >
            Quitar fechas
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
