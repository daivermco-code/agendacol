"use client";

import { useState } from "react";
import { addMonths, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { rangoDeVista } from "../lib/fechas";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function Mes({
  primero,
  hoy,
  ancla,
  enRango,
  onElegir,
}: {
  primero: string;
  hoy: string;
  ancla: string;
  enRango: (f: string) => boolean;
  onElegir: (f: string) => void;
}) {
  const { dias } = rangoDeVista("mes", primero);
  const mes = primero.slice(0, 7);
  return (
    <div className="grid grid-cols-7 gap-y-1 text-center text-[12px]">
      {DIAS.map((d) => (
        <span key={d} className="py-1 text-ac-neblina">
          {d}
        </span>
      ))}
      {dias.map((f) =>
        !f.startsWith(mes) ? (
          <span
            key={f}
            aria-hidden="true"
            className="cifras mx-auto flex h-11 w-11 md:h-8 md:w-8 items-center justify-center text-[13px] text-ac-neblina"
          >
            {Number(f.slice(8))}
          </span>
        ) : (
          <button
            key={f}
            type="button"
            onClick={() => onElegir(f)}
            aria-label={format(parseISO(f), "d 'de' MMMM yyyy", { locale: es })}
            aria-current={f === ancla ? "date" : undefined}
            className={cn(
              "cifras mx-auto flex h-11 w-11 md:h-8 md:w-8 items-center justify-center rounded-full text-[13px] transition-colors hover:bg-ac-laguna-claro",
              enRango(f) && "bg-ac-laguna-claro text-ac-laguna-hondo",
              f === hoy && "font-bold text-ac-laguna ring-1 ring-ac-laguna",
              f === ancla &&
                "bg-ac-laguna text-ac-papel hover:bg-ac-laguna-hondo",
            )}
          >
            {Number(f.slice(8))}
          </button>
        ),
      )}
    </div>
  );
}

/** Dos meses seguidos para saltar de fecha; el rango visible queda resaltado. */
export function MiniCalendario({
  ancla,
  hoy,
  desde,
  hasta,
  onElegir,
}: {
  ancla: string;
  hoy: string;
  desde: string;
  hasta: string;
  onElegir: (fecha: string) => void;
}) {
  const [primero, setPrimero] = useState(() => `${ancla.slice(0, 7)}-01`);
  const [anclaPrevia, setAnclaPrevia] = useState(ancla);
  if (anclaPrevia !== ancla) {
    setAnclaPrevia(ancla);
    const segundo = format(addMonths(parseISO(primero), 1), "yyyy-MM");
    if (!ancla.startsWith(primero.slice(0, 7)) && !ancla.startsWith(segundo))
      setPrimero(`${ancla.slice(0, 7)}-01`);
  }
  const meses = [
    primero,
    format(addMonths(parseISO(primero), 1), "yyyy-MM-dd"),
  ];
  const enRango = (f: string) => f >= desde && f <= hasta;
  const mover = (n: number) =>
    setPrimero(format(addMonths(parseISO(primero), n), "yyyy-MM-dd"));
  const titulo = (f: string) => {
    const t = format(parseISO(f), "MMMM yyyy", { locale: es });
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  return (
    <div className="space-y-4">
      {meses.map((m, i) => (
        <section key={m} aria-label={titulo(m)}>
          <div className="mb-1 flex items-center justify-between">
            {i === 0 ? (
              <button
                type="button"
                onClick={() => mover(-1)}
                aria-label="Mes anterior"
                className="area-tactil rounded p-1 hover:bg-ac-niebla"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            ) : (
              <span className="w-6" />
            )}
            <span className="text-[14px] font-medium">{titulo(m)}</span>
            {i === 0 ? (
              <button
                type="button"
                onClick={() => mover(1)}
                aria-label="Mes siguiente"
                className="area-tactil rounded p-1 hover:bg-ac-niebla"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <span className="w-6" />
            )}
          </div>
          <Mes
            primero={m}
            hoy={hoy}
            ancla={ancla}
            enRango={enRango}
            onElegir={onElegir}
          />
        </section>
      ))}
    </div>
  );
}
