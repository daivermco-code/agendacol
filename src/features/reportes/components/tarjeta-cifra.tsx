import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { textoPorcentaje } from "../lib/graficos";
import { variacion } from "../lib/periodos";

/**
 * Cifra principal con su cambio frente al período comparado. `puntos`: la cifra ya es un porcentaje y el cambio
 * va en puntos (ocupación). `mejor`: si subir es bueno o malo (inasistencias, por cobrar), para el color; la flecha
 * y el texto dicen la dirección, así que el color nunca va solo.
 */
export function TarjetaCifra({
  titulo,
  valor,
  ayuda,
  actual,
  anterior,
  textoAnterior,
  mejor = "sube",
  puntos = false,
  oscura = false,
}: {
  titulo: string;
  valor: string;
  ayuda: string;
  actual: number;
  anterior: number | null;
  textoAnterior?: string;
  mejor?: "sube" | "baja";
  puntos?: boolean;
  oscura?: boolean;
}) {
  const cambio =
    anterior === null
      ? null
      : puntos
        ? Math.round((actual - anterior) * 10) / 10
        : variacion(actual, anterior);
  const sube = cambio !== null && cambio > 0;
  const baja = cambio !== null && cambio < 0;
  const bueno = (sube && mejor === "sube") || (baja && mejor === "baja");
  const Flecha = sube ? ArrowUpRight : baja ? ArrowDownRight : Minus;
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border p-3 shadow-quieta sm:p-4",
        oscura
          ? "border-ac-noche bg-ac-noche text-ac-sobre-noche"
          : "border-ac-borde bg-ac-papel",
      )}
    >
      <p
        className={cn(
          "text-[13px] font-medium",
          oscura ? "text-ac-sobre-noche-suave" : "text-ac-pizarra",
        )}
      >
        {titulo}
      </p>
      <p className="mt-1 truncate text-xl font-bold leading-tight tracking-tight sm:text-[28px]">
        {valor}
      </p>
      <p
        className={cn(
          "mt-0.5 text-xs",
          oscura ? "text-ac-sobre-noche-suave" : "text-ac-neblina",
        )}
      >
        {ayuda}
      </p>
      {anterior !== null ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          {cambio !== null ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold",
                cambio === 0
                  ? oscura
                    ? "bg-ac-noche-claro text-ac-sobre-noche"
                    : "bg-ac-niebla text-ac-pizarra"
                  : bueno
                    ? "bg-ac-exito/10 text-ac-exito"
                    : "bg-ac-error/10 text-ac-error",
                oscura && cambio !== 0 && "bg-ac-sobre-noche dark:bg-ac-papel",
              )}
            >
              <Flecha className="h-3.5 w-3.5" aria-hidden="true" />
              {puntos
                ? `${cambio > 0 ? "+" : ""}${textoPorcentaje(cambio).replace(" %", "")} pts`
                : textoPorcentaje(Math.abs(cambio))}
              <span className="sr-only">
                {sube ? "más" : baja ? "menos" : "igual"} que el período
                comparado
              </span>
            </span>
          ) : null}
          <span
            className={oscura ? "text-ac-sobre-noche-suave" : "text-ac-pizarra"}
          >
            Antes: {textoAnterior ?? anterior}
          </span>
        </p>
      ) : null}
    </div>
  );
}
