import type { Metadata } from "next";
import { exigirPermiso } from "@/features/auth/services/miembro";
import { MisCobros } from "@/features/ventas/components/mis-cobros";
import { esquemaFiltrosCobros, leerCobros } from "@/features/ventas/services/caja";
import { hoyEnBogota } from "@/features/ventas/services/panel";
import { conPeriodo, profesionalesActivos } from "@/features/ventas/services/ventas";

export const metadata: Metadata = { title: "Mis cobros" };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaginaMisCobros({ searchParams }: Props) {
  await exigirPermiso("cobrar");
  const porDefecto = conPeriodo(esquemaFiltrosCobros.parse({}));
  const filtros = conPeriodo(esquemaFiltrosCobros.parse(await searchParams));
  const [filas, profesionales] = await Promise.all([leerCobros(filtros), profesionalesActivos()]);
  return (
    <MisCobros
      key={JSON.stringify(filtros)}
      filas={filas}
      filtros={filtros}
      porDefecto={porDefecto}
      profesionales={profesionales}
      hoy={hoyEnBogota()}
    />
  );
}
