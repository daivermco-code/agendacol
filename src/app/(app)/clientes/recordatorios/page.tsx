import type { Metadata } from "next";
import Link from "next/link";
import { endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { Settings } from "lucide-react";
import { exigirPermiso } from "@/features/auth/services/miembro";
import {
  CupoWhatsapp,
  NotaRecordatorios,
  ReservasSinRecordatorio,
  TarjetasRecordatorios,
} from "@/features/recordatorios/components/recordatorios-vista";
import { estadisticasRecordatorios } from "@/features/recordatorios/services/recordatorios";
import { EncabezadoReporte } from "@/features/reportes/components/encabezado-reporte";
import { leerPeriodo } from "@/features/reportes/lib/periodos";
import { hoyEnBogota } from "@/features/ventas/services/panel";

export const metadata: Metadata = { title: "Recordatorios" };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Recordatorios: por defecto el mes en curso entero (los que faltan salen como programados). */
export default async function PaginaRecordatorios({ searchParams }: Props) {
  await exigirPermiso("ver_marketing");
  const hoy = hoyEnBogota();
  const d = parseISO(hoy);
  const leido = leerPeriodo(await searchParams, {
    desde: format(startOfMonth(d), "yyyy-MM-dd"),
    hasta: format(endOfMonth(d), "yyyy-MM-dd"),
  });
  const periodo = { ...leido, comparar: "ninguna" as const, anterior: null };
  const datos = await estadisticasRecordatorios(periodo);

  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-4 lg:px-6 lg:py-6">
      <EncabezadoReporte
        titulo="Recordatorios"
        periodo={periodo}
        hoy={hoy}
        conComparar={false}
        accion={
          <Link
            href="/ajustes/recordatorios"
            className="inline-flex h-11 md:h-10 items-center gap-2 rounded-full border border-ac-borde bg-ac-papel px-4 text-sm font-medium hover:bg-ac-niebla"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Configurar</span>
            <span className="sr-only sm:hidden">Configurar</span>
          </Link>
        }
      />
      <NotaRecordatorios />
      <CupoWhatsapp cupo={datos.cupo} />
      <TarjetasRecordatorios datos={datos} />
      <ReservasSinRecordatorio
        total={datos.sinRecordatorio}
        filas={datos.reservasSinRecordatorio}
      />
    </main>
  );
}
