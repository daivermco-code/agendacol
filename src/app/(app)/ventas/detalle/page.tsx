import type { Metadata } from "next";
import { exigirPermiso } from "@/features/auth/services/miembro";
import { DetalleVentas } from "@/features/ventas/components/detalle-ventas";
import { VentasCelular } from "@/features/ventas/components/ventas-celular";
import {
  etiquetaRango,
  leerDia,
  leerVista,
  periodoCelular,
} from "@/features/ventas/lib/periodo-celular";
import { hoyEnBogota } from "@/features/ventas/services/panel";
import {
  conPeriodo,
  esquemaFiltrosVentas,
  listarVentas,
  metodosDePago,
  propinasCelular,
  ventasCelular,
} from "@/features/ventas/services/ventas";

export const metadata: Metadata = { title: "Detalle de ventas" };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaginaDetalleVentas({ searchParams }: Props) {
  await exigirPermiso("ver_ventas");
  const params = await searchParams;
  const hoy = hoyEnBogota();
  const porDefecto = conPeriodo(esquemaFiltrosVentas.parse({}));
  const filtros = conPeriodo(esquemaFiltrosVentas.parse(params));

  // Celular (T-12.11): fichas Hoy / Semana / Mes; con `desde`/`hasta` en la dirección, ese rango sin flechas.
  const libre = Boolean(params.desde || params.hasta);
  const vista = libre ? null : leerVista(params.vista);
  const dia = leerDia(params.dia, hoy);
  const periodo = vista
    ? periodoCelular(vista, dia, hoy)
    : {
        desde: filtros.desde,
        hasta: filtros.hasta,
        anterior: null,
        siguiente: null,
        etiqueta: etiquetaRango(filtros.desde, filtros.hasta, hoy),
      };
  const pestana = params.pestana === "propinas" ? "propinas" : "ventas";
  const rango = { desde: periodo.desde, hasta: periodo.hasta, q: filtros.q };

  // La página es la misma en el celular y en la tableta: si falla la lista del celular, la tabla sigue en pie.
  const sinLista = () => "error" as const;
  const [{ filas, total, resumen }, metodos, ventas, propinas] =
    await Promise.all([
      listarVentas(filtros),
      metodosDePago(),
      pestana === "ventas" ? ventasCelular(rango).catch(sinLista) : null,
      pestana === "propinas" ? propinasCelular(rango).catch(sinLista) : null,
    ]);
  return (
    <>
      <VentasCelular
        pestana={pestana}
        vista={vista}
        dia={dia}
        periodo={periodo}
        q={filtros.q}
        hoy={hoy}
        ventas={ventas}
        propinas={propinas}
      />
      <div className="hidden md:block">
        <DetalleVentas
          filas={filas}
          total={total}
          resumen={resumen}
          filtros={filtros}
          porDefecto={porDefecto}
          metodos={metodos}
          hoy={hoy}
        />
      </div>
    </>
  );
}
