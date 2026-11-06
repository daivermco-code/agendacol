"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Checkbox } from "@/shared/ui/checkbox";
import { fechasSerie } from "../lib/serie";
import { CADAS, NOMBRE_CADA, type Cada, type Repetir } from "../schemas";
import type { RevisionFecha } from "../types";

const SELECT =
  "h-11 md:h-9 rounded-md border border-ac-borde bg-ac-papel px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-foco";

/** "Repetir": cada cuánto, cuántas veces y la lista de fechas con sus choques (se puede saltar cualquiera). */
export function SerieReserva({
  fecha,
  repetir,
  omitir,
  revision,
  revisando,
  onCambio,
}: {
  fecha: string;
  repetir: Repetir;
  omitir: string[];
  revision: RevisionFecha[] | null;
  revisando: boolean;
  onCambio: (c: { repetir?: Repetir; omitir?: string[] }) => void;
}) {
  const fechas = fechasSerie(fecha, repetir);
  const choques = new Map(revision?.map((r) => [r.fecha, r.choques]) ?? []);
  const quedan = fechas.filter((f) => !omitir.includes(f)).length;
  return (
    <div className="space-y-2 rounded-lg border border-ac-borde p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select
          aria-label="Cada cuánto"
          className={SELECT}
          value={repetir.cada}
          onChange={(e) =>
            onCambio({ repetir: { ...repetir, cada: e.target.value as Cada } })
          }
        >
          {CADAS.map((c) => (
            <option key={c} value={c}>
              {NOMBRE_CADA[c]}
            </option>
          ))}
        </select>
        <select
          aria-label="Cuántas veces"
          className={SELECT}
          value={repetir.veces}
          onChange={(e) =>
            onCambio({ repetir: { ...repetir, veces: Number(e.target.value) } })
          }
        >
          {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
            <option key={n} value={n}>
              {n} veces
            </option>
          ))}
        </select>
        <span className="text-ac-pizarra">
          Se agendan {quedan} de {fechas.length}
        </span>
        {revisando ? (
          <Loader2
            className="h-4 w-4 animate-spin text-ac-neblina"
            aria-label="Revisando"
          />
        ) : null}
      </div>
      <ul
        className="max-h-48 space-y-1 overflow-y-auto"
        aria-label="Fechas de la serie"
      >
        {fechas.map((f) => {
          const lista = choques.get(f) ?? [];
          const saltada = omitir.includes(f);
          return (
            <li key={f} className="flex items-start gap-2 text-sm">
              <Checkbox
                id={`serie-${f}`}
                className="mt-0.5"
                checked={!saltada}
                aria-label={`Agendar el ${f.split("-").reverse().join("/")}`}
                onCheckedChange={(v) =>
                  onCambio({
                    omitir:
                      v === true
                        ? omitir.filter((x) => x !== f)
                        : [...omitir, f],
                  })
                }
              />
              <span
                className={cn(
                  "cifras w-28 shrink-0",
                  saltada && "line-through text-ac-neblina",
                )}
              >
                {format(parseISO(f), "EEE dd/MM/yyyy", { locale: es })}
              </span>
              {revision === null ? null : lista.length ? (
                <span className="flex min-w-0 items-start gap-1 text-ac-error">
                  <AlertTriangle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{lista.map((c) => c.resumen).join(" · ")}</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-ac-exito">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />{" "}
                  Libre
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
