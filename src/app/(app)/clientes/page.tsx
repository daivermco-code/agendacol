import type { Metadata } from "next";
import { exigirPermiso } from "@/features/auth/services/miembro";
import { BaseClientes } from "@/features/clientes/components/base-clientes";
import { ClientesCelular } from "@/features/clientes/components/clientes-celular";
import {
  esquemaFiltrosClientes,
  listaCelular,
  listarClientes,
  opcionesFiltros,
} from "@/features/clientes/services/clientes";

export const metadata: Metadata = { title: "Base de clientes" };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaginaClientes({ searchParams }: Props) {
  await exigirPermiso("ver_clientes");
  const filtros = esquemaFiltrosClientes.parse(await searchParams);
  // Celular (T-12.12): lista A–Z por nombre; si falla, se avisa y la tabla de la tableta sigue en pie.
  const [{ filas, total }, opciones, celular] = await Promise.all([
    listarClientes(filtros),
    opcionesFiltros(),
    listaCelular(filtros.q, 1).catch(() => "error" as const),
  ]);
  return (
    <>
      <ClientesCelular q={filtros.q} inicial={celular} />
      <div className="hidden md:block">
        <BaseClientes
          filas={filas}
          total={total}
          filtros={filtros}
          profesionales={opciones.profesionales}
          servicios={opciones.servicios}
        />
      </div>
    </>
  );
}
