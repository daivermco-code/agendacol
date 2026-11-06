import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { pesos } from "@/shared/lib/formato";
import { SERIES } from "../lib/graficos";
import type { Comparadas } from "../services/reportes";
import type { EstadisticasVentas } from "../types";
import { Linea, type Punto } from "./graficos";
import { BarraPartes, ListaBarras, Panel, VerDatos } from "./piezas";
import { TarjetaCifra } from "./tarjeta-cifra";

type Datos = Comparadas<EstadisticasVentas>;

const promedio = (v: EstadisticasVentas) =>
  v.cantidad ? Math.round(v.total / v.cantidad) : 0;
const corta = (f: string) => format(parseISO(f), "d MMM", { locale: es });

function Tarjetas({ actual: a, anterior: b }: Datos) {
  return (
    <section
      aria-label="Cifras del período"
      className="grid grid-cols-2 gap-3 xl:grid-cols-4"
    >
      <TarjetaCifra
        oscura
        titulo="Ventas facturadas"
        valor={pesos(a.total)}
        ayuda={`Sin ${a.anuladas} anuladas; descuentos por ${pesos(a.descuentos)}`}
        actual={a.total}
        anterior={b?.total ?? null}
        textoAnterior={b ? pesos(b.total) : undefined}
      />
      <TarjetaCifra
        titulo="Cantidad de ventas"
        valor={String(a.cantidad)}
        ayuda="Ventas cerradas en el período"
        actual={a.cantidad}
        anterior={b?.cantidad ?? null}
      />
      <TarjetaCifra
        titulo="Ticket promedio"
        valor={pesos(promedio(a))}
        ayuda="Lo que deja cada venta en promedio"
        actual={promedio(a)}
        anterior={b ? promedio(b) : null}
        textoAnterior={b ? pesos(promedio(b)) : undefined}
      />
      <TarjetaCifra
        titulo="Por cobrar"
        valor={pesos(a.porCobrar)}
        ayuda="Saldos de ventas en pago parcial"
        actual={a.porCobrar}
        anterior={b?.porCobrar ?? null}
        textoAnterior={b ? pesos(b.porCobrar) : undefined}
        mejor="baja"
      />
    </section>
  );
}

function TablaItems({
  filas,
  vacio,
}: {
  filas: { nombre: string; cantidad: number; total: number }[];
  vacio: string;
}) {
  if (!filas.length)
    return <p className="py-6 text-center text-sm text-ac-pizarra">{vacio}</p>;
  return (
    <table className="w-full table-fixed text-sm">
      <thead className="text-left text-[13px] text-ac-pizarra">
        <tr className="border-b border-ac-borde">
          <th scope="col" className="py-2 pr-3 font-semibold">
            Nombre
          </th>
          <th scope="col" className="w-14 px-2 py-2 text-right font-semibold sm:w-24 sm:px-3">
            <abbr title="Cantidad" className="no-underline sm:hidden">
              Cant.
            </abbr>
            <span className="hidden sm:inline">Cantidad</span>
          </th>
          <th scope="col" className="w-28 py-2 pl-3 text-right font-semibold">
            Total
          </th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => (
          <tr key={f.nombre} className="border-b border-ac-borde last:border-0">
            <td className="break-words py-2 pr-3 sm:max-w-0 sm:truncate">{f.nombre}</td>
            <td className="cifras px-2 text-right sm:px-3">{f.cantidad}</td>
            <td className="cifras py-2 pl-3 text-right font-semibold">
              {pesos(f.total)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Reporte de ventas: cifras, ventas día a día, por tipo de ítem, categoría, servicio, producto y profesional. */
export function ReporteVentas({ datos }: { datos: Datos }) {
  const { actual: a, anterior: b } = datos;
  const porFecha: Punto[] = a.porFecha.map((f, i) => ({
    etiqueta: corta(f.fecha),
    actual: f.total,
    anterior: b?.porFecha[i]?.total ?? null,
    etiquetaAnterior: b?.porFecha[i] ? corta(b.porFecha[i].fecha) : undefined,
  }));
  return (
    <div className="space-y-4">
      <Tarjetas {...datos} />
      <Panel
        titulo="Ventas por día"
        ayuda="Total facturado cada día, sin las anuladas"
      >
        <Linea datos={porFecha} formato="pesos" />
        <VerDatos
          columnas={["Fecha", "Ventas", "Total"]}
          filas={a.porFecha.map((f) => [
            corta(f.fecha),
            f.cantidad,
            pesos(f.total),
          ])}
        />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          titulo="Por tipo de ítem"
          ayuda="Lo vendido en servicios, productos y otros ítems (antes del descuento)"
        >
          <BarraPartes
            formato={pesos}
            partes={[
              {
                nombre: "Servicios",
                valor: a.porTipo.servicios,
                color: SERIES[0],
              },
              {
                nombre: "Productos",
                valor: a.porTipo.productos,
                color: SERIES[1],
              },
              { nombre: "Otros", valor: a.porTipo.otros, color: SERIES[2] },
            ]}
          />
        </Panel>
        <Panel
          titulo="Por categoría"
          ayuda="Categoría del servicio; los productos van juntos"
        >
          <ListaBarras
            formato={pesos}
            filas={a.categorias.map((c) => ({
              nombre: c.nombre,
              valor: c.total,
            }))}
          />
        </Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          titulo="Servicios más vendidos"
          ayuda="Los 10 que más facturaron"
        >
          <TablaItems
            filas={a.servicios}
            vacio="Sin servicios vendidos en este período."
          />
        </Panel>
        <Panel
          titulo="Productos más vendidos"
          ayuda="Los 10 que más facturaron"
        >
          <TablaItems
            filas={a.productos}
            vacio="Sin productos vendidos en este período."
          />
        </Panel>
      </div>
      <Panel
        titulo="Por profesional"
        ayuda="Lo que vendió cada quien (servicios y productos a su nombre)"
      >
        <ListaBarras
          formato={pesos}
          filas={a.profesionales.map((p) => ({
            nombre: p.nombre,
            valor: p.total,
          }))}
        />
      </Panel>
    </div>
  );
}
