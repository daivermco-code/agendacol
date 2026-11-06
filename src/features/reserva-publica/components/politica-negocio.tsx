import { Info } from "lucide-react";
import type { ReglasSitio } from "../types";

type Reglas = Pick<
  ReglasSitio,
  "cancela" | "cambia" | "limiteHoras" | "politica"
>;

/** "Cancelas o cambias desde tu enlace hasta 2 horas antes" (o "comunícate con el negocio"). */
export function textoCambios(r: Reglas): string {
  const que =
    r.cancela && r.cambia
      ? "cancelar o cambiar"
      : r.cancela
        ? "cancelar"
        : r.cambia
          ? "cambiar"
          : null;
  if (!que)
    return "Para cancelar o cambiar tu cita, comunícate con el negocio.";
  const hasta =
    r.limiteHoras > 0
      ? `hasta ${r.limiteHoras} horas antes`
      : "hasta la hora de la cita";
  const resto =
    r.cancela && r.cambia
      ? ""
      : ` Para ${r.cancela ? "cambiarla" : "cancelarla"}, comunícate con el negocio.`;
  return `Puedes ${que} tu cita desde tu enlace ${hasta}.${resto}`;
}

/** Lo que el negocio pide (Ajustes → Sitio web) y hasta cuándo se cambia o cancela en línea. */
export function PoliticaNegocio({ reglas }: { reglas: Reglas }) {
  return (
    <section
      aria-label="Política del negocio"
      className="flex gap-3 rounded-lg border border-ac-borde bg-ac-niebla p-4 text-sm"
    >
      <Info
        className="mt-0.5 h-4 w-4 shrink-0 text-ac-pizarra"
        aria-hidden="true"
      />
      <div className="space-y-1">
        <p>{textoCambios(reglas)}</p>
        {reglas.politica ? (
          <p className="whitespace-pre-line text-ac-pizarra">
            {reglas.politica}
          </p>
        ) : null}
      </div>
    </section>
  );
}
