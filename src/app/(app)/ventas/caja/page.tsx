import type { Metadata } from "next";
import { exigirPermiso } from "@/features/auth/services/miembro";
import { Caja } from "@/features/ventas/components/caja";
import { esquemaFiltrosCaja, leerCaja, localesActivos } from "@/features/ventas/services/caja";
import { hoyEnBogota } from "@/features/ventas/services/panel";

export const metadata: Metadata = { title: "Caja de ventas" };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaginaCaja({ searchParams }: Props) {
  await exigirPermiso("ver_caja");
  const locales = await localesActivos();
  const hoy = hoyEnBogota();
  // La caja se cuadra por día: sin período en la dirección, muestra hoy.
  const porDefecto = { ...esquemaFiltrosCaja.parse({}), desde: hoy, hasta: hoy, local: locales[0]?.id ?? "" };
  const leidos = esquemaFiltrosCaja.parse(await searchParams);
  const filtros = {
    ...leidos,
    desde: leidos.desde || hoy,
    hasta: leidos.hasta || hoy,
    local: locales.some((l) => l.id === leidos.local) ? leidos.local : porDefecto.local,
  };
  if (!filtros.local) {
    return (
      <main className="mx-auto max-w-xl p-6 text-center text-ac-pizarra">Crea un local para usar la caja.</main>
    );
  }
  const { filas, total, resumen } = await leerCaja(filtros);
  return (
    <Caja
      filas={filas}
      total={total}
      resumen={resumen}
      filtros={filtros}
      porDefecto={porDefecto}
      locales={locales}
      hoy={hoy}
    />
  );
}
