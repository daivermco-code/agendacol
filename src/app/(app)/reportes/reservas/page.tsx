import type { Metadata } from "next";
import { format, parseISO, subDays } from "date-fns";
import { z } from "zod";
import { exigirPermiso } from "@/features/auth/services/miembro";
import {
  EncabezadoReporte,
  PestanasReporte,
} from "@/features/reportes/components/encabezado-reporte";
import {
  VistaGeneral,
  VistaHistorial,
  VistaRendimiento,
} from "@/features/reportes/components/reporte-reservas";
import { leerPeriodo } from "@/features/reportes/lib/periodos";
import { reservasComparadas } from "@/features/reportes/services/reportes";
import { hoyEnBogota } from "@/features/ventas/services/panel";
import { BotonExportar } from "@/shared/components/boton-exportar";

export const metadata: Metadata = { title: "Reporte de reservas" };

const VISTAS = [
  { id: "general", nombre: "General" },
  { id: "historial", nombre: "Historial" },
  { id: "rendimiento", nombre: "Rendimiento" },
] as const;
type Vista = (typeof VISTAS)[number]["id"];
const esquemaVista = z
  .enum(["general", "historial", "rendimiento"])
  .catch("general");

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Reporte de reservas: por defecto los últimos 30 días contra los 30 anteriores. */
export default async function PaginaReporteReservas({ searchParams }: Props) {
  await exigirPermiso("ver_reportes_reservas");
  const params = await searchParams;
  const hoy = hoyEnBogota();
  const periodo = leerPeriodo(params, {
    desde: format(subDays(parseISO(hoy), 29), "yyyy-MM-dd"),
    hasta: hoy,
  });
  const vista: Vista = esquemaVista.parse(params.vista);
  const datos = await reservasComparadas(periodo);
  const enlace = (id: Vista) => {
    const p = new URLSearchParams({
      desde: periodo.desde,
      hasta: periodo.hasta,
    });
    if (periodo.comparar !== "anterior") p.set("comparar", periodo.comparar);
    if (id !== "general") p.set("vista", id);
    return `/reportes/reservas?${p.toString()}`;
  };
  const exportar = `/api/exportar/reservas?${new URLSearchParams({ desde: periodo.desde, hasta: periodo.hasta }).toString()}`;

  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-4 lg:px-6 lg:py-6">
      <EncabezadoReporte
        titulo="Reporte de reservas"
        periodo={periodo}
        hoy={hoy}
        accion={<BotonExportar href={exportar} />}
      />
      <PestanasReporte pestanas={[...VISTAS]} activa={vista} enlace={enlace} />
      {vista === "general" ? <VistaGeneral datos={datos} /> : null}
      {vista === "historial" ? <VistaHistorial datos={datos} /> : null}
      {vista === "rendimiento" ? <VistaRendimiento datos={datos} /> : null}
    </main>
  );
}
