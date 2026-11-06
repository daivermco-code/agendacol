import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/shared/lib/utils";
import type { PeriodoReporte } from "../types";
import { FiltroPeriodo } from "./filtro-periodo";

/** Título del reporte, su acción (exportar) y el filtro de período en una sola fila arriba de todo. */
export function EncabezadoReporte({
  titulo,
  periodo,
  hoy,
  accion,
  conComparar = true,
}: {
  titulo: string;
  periodo: PeriodoReporte;
  hoy: string;
  accion?: ReactNode;
  conComparar?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h1 className="flex-1 text-[28px] font-bold leading-tight tracking-tight md:text-2xl">
          {titulo}
        </h1>
        {accion}
      </div>
      <div className="rounded-lg border border-ac-borde bg-ac-papel p-3 shadow-quieta sm:p-4">
        <FiltroPeriodo periodo={periodo} hoy={hoy} conComparar={conComparar} />
      </div>
    </div>
  );
}

/** Pestañas que viven en la dirección (?vista=), para poder compartir el reporte abierto donde estaba. */
export function PestanasReporte<T extends string>({
  pestanas,
  activa,
  enlace,
}: {
  pestanas: { id: T; nombre: string }[];
  activa: T;
  enlace: (id: T) => string;
}) {
  return (
    <nav
      aria-label="Secciones del reporte"
      className="border-b border-ac-borde"
    >
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {pestanas.map((p) => (
          <li key={p.id}>
            <Link
              href={enlace(p.id)}
              scroll={false}
              aria-current={p.id === activa ? "page" : undefined}
              className={cn(
                "inline-block whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium md:py-2.5",
                p.id === activa
                  ? "border-ac-laguna text-ac-laguna-hondo"
                  : "border-transparent text-ac-pizarra hover:text-ac-tinta",
              )}
            >
              {p.nombre}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
