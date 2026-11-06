import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TOTAL_PASOS as TOTAL } from "@/features/primeros-pasos/lib/pasos";
import { cn } from "@/shared/lib/utils";

/** Anillo de avance "n/6" de Primeros pasos. */
export function AnilloAvance({
  hechos,
  className,
}: {
  hechos: number;
  className?: string;
}) {
  const r = 9;
  const largo = 2 * Math.PI * r;
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-6 w-6 -rotate-90", className)}
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <circle
        cx="12"
        cy="12"
        r={r}
        fill="none"
        stroke="hsl(var(--ac-laguna))"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${(largo * hechos) / TOTAL} ${largo}`}
      />
    </svg>
  );
}

export function BotonPrimerosPasos({ hechos }: { hechos: number }) {
  return (
    <Link
      href="/primeros-pasos"
      className="inline-flex h-9 items-center gap-2 rounded-md px-2.5 text-[13px] text-ac-sobre-noche hover:bg-ac-noche-claro"
    >
      <AnilloAvance hechos={hechos} />
      <span className="cifras font-semibold">
        {hechos}/{TOTAL}
      </span>
      <span className="hidden xl:inline">Primeros pasos</span>
    </Link>
  );
}

/** Barra propia de ~60 px bajo la barra superior de 768 a 1023 px (en el celular, va en el centro de Ajustes). */
export function BarraPrimerosPasos({ hechos }: { hechos: number }) {
  return (
    <Link
      href="/primeros-pasos"
      className="hidden h-[60px] items-center gap-3 border-b border-ac-borde bg-ac-papel px-4 md:flex lg:hidden"
    >
      <AnilloAvance hechos={hechos} className="h-8 w-8 text-ac-neblina" />
      <span className="flex-1">
        <span className="cifras block text-[13px] text-ac-pizarra">
          {hechos}/{TOTAL}
        </span>
        <span className="block font-semibold">Primeros pasos</span>
      </span>
      <span className="inline-flex items-center gap-0.5 font-semibold text-ac-laguna">
        {hechos >= TOTAL ? "Repasar" : "Completar"}{" "}
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </Link>
  );
}
