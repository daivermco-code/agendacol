import type { Metadata } from "next";
import { format, parseISO, subDays } from "date-fns";
import { exigirPermiso } from "@/features/auth/services/miembro";
import { EncabezadoReporte } from "@/features/reportes/components/encabezado-reporte";
import { ReporteVentas } from "@/features/reportes/components/reporte-ventas";
import { leerPeriodo } from "@/features/reportes/lib/periodos";
import { ventasComparadas } from "@/features/reportes/services/reportes";
import { hoyEnBogota } from "@/features/ventas/services/panel";
import { BotonExportar } from "@/shared/components/boton-exportar";

export const metadata: Metadata = { title: "Reporte de ventas" };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Reporte de ventas (solo el dueño): por defecto los últimos 30 días contra los 30 anteriores. */
export default async function PaginaReporteVentas({ searchParams }: Props) {
  await exigirPermiso("ver_reportes_ventas");
  const hoy = hoyEnBogota();
  const periodo = leerPeriodo(await searchParams, {
    desde: format(subDays(parseISO(hoy), 29), "yyyy-MM-dd"),
    hasta: hoy,
  });
  const datos = await ventasComparadas(periodo);
  const exportar = `/api/exportar/ventas?${new URLSearchParams({ desde: periodo.desde, hasta: periodo.hasta }).toString()}`;
  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-4 lg:px-6 lg:py-6">
      <EncabezadoReporte
        titulo="Reporte de ventas"
        periodo={periodo}
        hoy={hoy}
        accion={<BotonExportar href={exportar} />}
      />
      <ReporteVentas datos={datos} />
    </main>
  );
}
