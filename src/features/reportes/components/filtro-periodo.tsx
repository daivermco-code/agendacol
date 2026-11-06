"use client";

import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { RangoFechas } from "@/shared/components/rango-fechas";
import { atajosPeriodo } from "@/features/ventas/lib/periodos";
import { COMPARACIONES, textoPeriodo } from "../lib/periodos";
import type { Comparacion, PeriodoReporte } from "../types";

const SELECTOR =
  "h-11 w-full rounded-md border border-input bg-ac-papel px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring md:h-9";

/**
 * Período y comparación de un reporte, guardados en la dirección (?desde&hasta&comparar). `conComparar={false}`
 * deja solo el período (pantallas que no comparan, como Recordatorios).
 */
export function FiltroPeriodo({
  periodo,
  hoy,
  conComparar = true,
}: {
  periodo: PeriodoReporte;
  hoy: string;
  conComparar?: boolean;
}) {
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();
  const [cargando, iniciar] = useTransicionRed();

  function ir(
    cambio: Partial<{ desde: string; hasta: string; comparar: Comparacion }>,
  ) {
    const p = new URLSearchParams(params.toString());
    const nuevo = {
      desde: periodo.desde,
      hasta: periodo.hasta,
      comparar: periodo.comparar,
      ...cambio,
    };
    p.set("desde", nuevo.desde);
    p.set("hasta", nuevo.hasta);
    if (nuevo.comparar === "anterior") p.delete("comparar");
    else p.set("comparar", nuevo.comparar);
    iniciar(() => router.push(`${ruta}?${p.toString()}`, { scroll: false }));
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:items-end">
        <label className="block text-[13px] font-medium text-ac-pizarra lg:w-64">
          Período
          <RangoFechas
            id="periodo-reporte"
            valor={{ desde: periodo.desde, hasta: periodo.hasta }}
            atajos={atajosPeriodo(hoy)}
            onCambio={(r) => r.desde && r.hasta && ir(r)}
            className="mt-1 font-normal text-ac-tinta"
          />
        </label>
        {conComparar ? (
          <label className="block text-[13px] font-medium text-ac-pizarra lg:w-64">
            Comparar con
            <select
              className={`${SELECTOR} mt-1 font-normal text-ac-tinta`}
              value={periodo.comparar}
              onChange={(e) => ir({ comparar: e.target.value as Comparacion })}
            >
              {COMPARACIONES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {cargando ? (
          <Loader2
            className="mb-2.5 h-4 w-4 animate-spin text-ac-laguna"
            aria-label="Cargando"
          />
        ) : null}
      </div>
      <p className="text-[13px] text-ac-pizarra">
        Mostrando{" "}
        <strong className="font-semibold text-ac-tinta">
          {textoPeriodo(periodo.desde, periodo.hasta)}
        </strong>
        {periodo.anterior ? (
          <>
            {" "}
            · comparado con{" "}
            {textoPeriodo(periodo.anterior.desde, periodo.anterior.hasta)}
          </>
        ) : null}
      </p>
    </div>
  );
}
