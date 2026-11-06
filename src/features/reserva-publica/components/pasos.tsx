import { Check } from "lucide-react";
import { cn } from "@/shared/lib/utils";

const PASOS = ["Servicios", "Fecha y hora", "Tus datos"] as const;

/** 1 Servicios · 2 Fecha y hora · 3 Tus datos, con el actual marcado. */
export function Pasos({ actual }: { actual: 1 | 2 | 3 }) {
  return (
    <ol
      className="mb-5 flex items-center gap-2 text-sm"
      aria-label="Pasos de la reserva"
    >
      {PASOS.map((nombre, i) => {
        const n = i + 1;
        const hecho = n < actual;
        return (
          <li
            key={nombre}
            className="flex min-w-0 items-center gap-2"
            aria-current={n === actual ? "step" : undefined}
          >
            <span
              className={cn(
                "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                n === actual && "bg-ac-laguna text-ac-papel",
                hecho && "bg-ac-laguna-claro text-ac-laguna-hondo",
                n > actual && "bg-ac-niebla-oscura text-ac-pizarra",
              )}
            >
              {hecho ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : n}
            </span>
            <span
              className={cn(
                "truncate",
                n === actual
                  ? "font-semibold"
                  : "text-ac-pizarra hidden sm:inline",
              )}
            >
              {nombre}
            </span>
            {n < PASOS.length ? (
              <span
                className="h-px w-4 shrink-0 bg-ac-borde-fuerte sm:w-8"
                aria-hidden="true"
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
