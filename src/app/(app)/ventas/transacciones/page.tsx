import type { Metadata } from "next";
import { exigirPermiso } from "@/features/auth/services/miembro";
import { Transacciones } from "@/features/ventas/components/transacciones";
import { hoyEnBogota } from "@/features/ventas/services/panel";
import {
  conPeriodo,
  esquemaFiltrosPagos,
  listarPagos,
  metodosDePago,
} from "@/features/ventas/services/ventas";

export const metadata: Metadata = { title: "Transacciones" };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaginaTransacciones({ searchParams }: Props) {
  await exigirPermiso("ver_ventas");
  const porDefecto = conPeriodo(esquemaFiltrosPagos.parse({}));
  const filtros = conPeriodo(esquemaFiltrosPagos.parse(await searchParams));
  const [{ filas, total, resumen }, metodos] = await Promise.all([listarPagos(filtros), metodosDePago()]);
  return (
    <Transacciones
      filas={filas}
      total={total}
      resumen={resumen}
      filtros={filtros}
      porDefecto={porDefecto}
      metodos={metodos}
      hoy={hoyEnBogota()}
    />
  );
}
