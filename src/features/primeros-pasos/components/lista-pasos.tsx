import Link from "next/link";
import { Check, ChevronRight, Compass } from "lucide-react";
import { AnilloAvance } from "@/features/marco/primeros-pasos";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { type ClavePaso, PASOS, TOTAL_PASOS, rutaDelPaso } from "../lib/pasos";

/** Primeros pasos: el avance n/6, la lista con lo hecho y lo que falta, y la entrada al recorrido guiado. */
export function ListaPasos({ estado }: { estado: Record<ClavePaso, boolean> }) {
  const hechos = PASOS.filter((p) => estado[p.clave]).length;
  const completo = hechos === TOTAL_PASOS;
  return (
    <>
      <header className="mb-4">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-2xl">
          Primeros pasos
        </h1>
        <p className="text-ac-pizarra">
          Seis pasos para dejar listo el negocio. El recorrido te lleva a cada
          pantalla y te señala dónde se hace.
        </p>
      </header>

      <section
        aria-label="Avance"
        className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-ac-borde bg-ac-papel p-4 shadow-quieta sm:p-5"
      >
        <AnilloAvance hechos={hechos} className="h-14 w-14 text-ac-neblina" />
        <div className="min-w-0 flex-1">
          <p className="cifras text-lg font-bold">
            {hechos} de {TOTAL_PASOS} listos
          </p>
          <p className="text-sm text-ac-pizarra">
            {completo
              ? "Con los datos de la demo ya está todo hecho. Igual puedes recorrerlo para ver dónde queda cada cosa."
              : "Lo que falta queda marcado abajo."}
          </p>
        </div>
        <Button asChild>
          <Link href={rutaDelPaso(1)}>
            <Compass className="h-4 w-4" aria-hidden="true" /> Empezar el
            recorrido
          </Link>
        </Button>
      </section>

      <ol className="divide-y divide-ac-borde rounded-lg border border-ac-borde bg-ac-papel shadow-quieta">
        {PASOS.map((p, i) => {
          const hecho = estado[p.clave];
          return (
            <li key={p.clave} className="flex gap-3 p-4 sm:gap-4 sm:p-5">
              <span
                className={cn(
                  "cifras mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                  hecho
                    ? "bg-ac-exito text-ac-papel"
                    : "border-2 border-ac-borde-fuerte text-ac-pizarra",
                )}
                aria-hidden="true"
              >
                {hecho ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">
                  {p.titulo}
                  <span className="sr-only">
                    {hecho ? " (listo)" : " (pendiente)"}
                  </span>
                </h2>
                <p className="mt-0.5 text-sm text-ac-pizarra">{p.texto}</p>
                <Link
                  href={rutaDelPaso(i + 1)}
                  className="mt-2 inline-flex items-center gap-0.5 text-sm font-semibold min-h-11 md:min-h-0 text-ac-laguna hover:underline"
                >
                  Mostrarme dónde
                  <span className="sr-only">: {p.titulo}</span>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
