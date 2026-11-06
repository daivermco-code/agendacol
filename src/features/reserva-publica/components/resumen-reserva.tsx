import { CalendarDays, UserRound } from "lucide-react";
import { duracion, pesos } from "@/shared/lib/formato";
import { fechaLarga } from "../lib/fechas-publicas";
import { sumarMinutos, totales, type Linea } from "../lib/seleccion";
import type { Portada } from "../types";

interface Props {
  portada: Portada;
  lineas: Linea[];
  /** Nombre del profesional o null = cualquiera. */
  profesional: string | null;
  fecha: string | null;
  hora: string | null;
}

/** Tarjeta "Tu reserva": servicios, total, profesional, día y hora (lo elegido hasta ahora). */
export function ResumenReserva({
  portada,
  lineas,
  profesional,
  fecha,
  hora,
}: Props) {
  const t = totales(lineas, portada.servicios);
  return (
    <section
      aria-label="Tu reserva"
      className="rounded-lg border border-ac-borde bg-ac-papel p-4 shadow-quieta"
    >
      <h2 className="font-semibold">Tu reserva</h2>
      <p className="text-sm text-ac-pizarra">{portada.negocio.nombre}</p>
      <ul className="mt-3 divide-y divide-ac-borde border-y border-ac-borde">
        {lineas.map((l) => {
          const s = portada.servicios.find((x) => x.id === l.id);
          if (!s) return null;
          return (
            <li key={l.id} className="flex justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="font-medium">
                  {s.nombre}
                  {l.cantidad > 1 ? (
                    <span className="text-ac-pizarra"> × {l.cantidad}</span>
                  ) : null}
                </p>
                <p className="text-xs text-ac-neblina">
                  {duracion(s.duracion * l.cantidad)}
                </p>
              </div>
              {s.precio !== null ? (
                <span className="shrink-0 tabular-nums">
                  {pesos(s.precio * l.cantidad)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="flex justify-between py-2.5 font-semibold">
        <span>Total · {duracion(t.minutos)}</span>
        <span className="tabular-nums">
          {t.precioCompleto ? pesos(t.precio) : "En el local"}
        </span>
      </p>
      <dl className="space-y-2 border-t border-ac-borde pt-3 text-sm">
        <div className="flex items-center gap-2">
          <dt className="sr-only">Profesional</dt>
          <UserRound
            className="h-4 w-4 shrink-0 text-ac-pizarra"
            aria-hidden="true"
          />
          <dd>{profesional ?? "Cualquier profesional disponible"}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">Fecha y hora</dt>
          <CalendarDays
            className="h-4 w-4 shrink-0 text-ac-pizarra"
            aria-hidden="true"
          />
          <dd>
            {fecha ? fechaLarga(fecha) : "Elige el día"}
            {fecha && hora
              ? ` · ${hora} a ${sumarMinutos(hora, t.minutos)}`
              : ""}
          </dd>
        </div>
      </dl>
    </section>
  );
}
