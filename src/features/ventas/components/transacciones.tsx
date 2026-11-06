"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeftRight, Search } from "lucide-react";
import { BotonExportar } from "@/shared/components/boton-exportar";
import { Paginacion } from "@/shared/components/paginacion";
import { Vacio } from "@/shared/components/vacio";
import { enlaceExportar } from "@/shared/lib/csv";
import { pesos } from "@/shared/lib/formato";
import { cn } from "@/shared/lib/utils";
import { useFiltrosUrl } from "../hooks/use-filtros-url";
import type { FiltrosPagos, FilaPago, ResumenPagos } from "../services/ventas";
import { usePanelVenta } from "../store/panel-venta";
import { DonaMetodos } from "./dona-metodos";
import {
  CampoBuscar,
  Encabezado,
  FiltroPeriodo,
  SELECTOR,
  TarjetaFiltro,
} from "./piezas-listado";

const fechaHora = (f: string) =>
  format(parseISO(f), "d MMM yyyy · HH:mm", { locale: es });

function EstadoPago({ p }: { p: FilaPago }) {
  if (p.ventaEstado === "anulada")
    return (
      <span className="rounded-full bg-ac-niebla-oscura px-2 py-0.5 text-xs font-medium text-ac-pizarra">
        Anulada
      </span>
    );
  if (p.abono)
    return (
      <span className="rounded-full bg-ac-aviso-fondo px-2 py-0.5 text-xs font-medium text-ac-aviso">
        Abono
      </span>
    );
  return (
    <span className="rounded-full bg-ac-exito-fondo px-2 py-0.5 text-xs font-medium text-ac-exito">
      Pagado
    </span>
  );
}

/** En el celular la tabla no cabe: cada pago va en dos líneas y el número abre la venta. */
function ListaMovil({ filas }: { filas: FilaPago[] }) {
  const ver = usePanelVenta((s) => s.ver);
  return (
    <ul className="divide-y divide-ac-borde rounded-lg border border-ac-borde sm:hidden">
      {filas.map((p) => (
        <li key={p.id} className="space-y-1 px-3 py-2.5 text-sm">
          <p className="flex items-baseline gap-1">
            {/* Fuera del truncate: su overflow recortaría el área táctil. */}
            <button
              type="button"
              className="area-tactil cifras shrink-0 font-medium text-ac-laguna-hondo hover:underline"
              onClick={() => ver(p.ventaId)}
              aria-label={`Ver la venta ${p.venta}`}
            >
              Venta {p.venta}
            </button>
            <span className="min-w-0 flex-1 truncate">· {p.cliente}</span>
            <span
              className={cn(
                "cifras shrink-0 font-medium",
                p.ventaEstado === "anulada" && "line-through",
              )}
            >
              {pesos(p.monto)}
            </span>
          </p>
          <p className="flex items-center justify-between gap-2 text-xs text-ac-pizarra">
            <span className="cifras truncate">
              {fechaHora(p.fecha)} · {p.metodo}
            </span>
            <EstadoPago p={p} />
          </p>
        </li>
      ))}
    </ul>
  );
}

function Tabla({ filas }: { filas: FilaPago[] }) {
  const ver = usePanelVenta((s) => s.ver);
  return (
    <div className="hidden overflow-hidden rounded-lg border border-ac-borde sm:block">
      <table className="w-full text-sm">
        <thead className="bg-ac-niebla text-left">
          <tr>
            <th scope="col" className="px-3 py-2.5 font-semibold">
              Fecha
            </th>
            <th
              scope="col"
              className="hidden px-3 py-2.5 font-semibold lg:table-cell"
            >
              Comprobante
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
              Monto
            </th>
            <th
              scope="col"
              className="hidden px-3 py-2.5 text-right font-semibold xl:table-cell"
            >
              Propina
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold">
              Método
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold">
              Venta
            </th>
            <th
              scope="col"
              className="hidden px-3 py-2.5 font-semibold md:table-cell"
            >
              Estado de pago
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((p) => (
            <tr key={p.id} className="border-t border-ac-borde">
              <td className="cifras whitespace-nowrap px-3 py-2.5">
                {fechaHora(p.fecha)}
              </td>
              <td className="cifras hidden px-3 py-2.5 lg:table-cell">
                {p.comprobante ?? "—"}
              </td>
              <td
                className={cn(
                  "cifras px-3 py-2.5 text-right",
                  p.ventaEstado === "anulada" && "line-through",
                )}
              >
                {pesos(p.monto)}
              </td>
              <td className="cifras hidden px-3 py-2.5 text-right xl:table-cell">
                {p.propina ? pesos(p.propina) : "—"}
              </td>
              <td className="px-3 py-2.5">{p.metodo}</td>
              <td className="px-3 py-2.5">
                <button
                  type="button"
                  className="area-tactil cifras font-medium text-ac-laguna-hondo hover:underline"
                  onClick={() => ver(p.ventaId)}
                  aria-label={`Ver la venta ${p.venta}`}
                >
                  {p.venta}
                </button>
                <span className="block max-w-[160px] truncate text-xs text-ac-pizarra">
                  {p.cliente}
                </span>
              </td>
              <td className="hidden px-3 py-2.5 md:table-cell">
                <EstadoPago p={p} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Transacciones: cada pago recibido, con tarjetas, filtros, dona de métodos y tabla (US-041). */
export function Transacciones({
  filas,
  total,
  resumen,
  filtros,
  porDefecto,
  metodos,
  hoy,
}: {
  filas: FilaPago[];
  total: number;
  resumen: ResumenPagos;
  filtros: FiltrosPagos;
  porDefecto: FiltrosPagos;
  metodos: { id: string; nombre: string }[];
  hoy: string;
}) {
  const { ir, cargando } = useFiltrosUrl(filtros, porDefecto);
  const conFiltros =
    filtros.q !== "" || filtros.metodo !== "" || filtros.tipo !== "";
  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-4 lg:px-6 lg:py-6">
      <Encabezado
        titulo="Transacciones"
        texto="Cada pago recibido, con su método y la venta a la que pertenece."
      >
        <BotonExportar href={enlaceExportar("transacciones", filtros)} />
      </Encabezado>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="grid content-start gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          <TarjetaFiltro
            titulo="Todas"
            n={resumen.todas.n}
            monto={resumen.todas.monto}
            activa={filtros.tipo === ""}
            onClick={() => ir({ tipo: "" })}
          />
          <TarjetaFiltro
            titulo="Abonos"
            tono="aviso"
            n={resumen.abonos.n}
            monto={resumen.abonos.monto}
            activa={filtros.tipo === "abonos"}
            onClick={() => ir({ tipo: "abonos" })}
          />
          <TarjetaFiltro
            titulo="De ventas anuladas"
            tono="neutro"
            n={resumen.anuladas.n}
            monto={resumen.anuladas.monto}
            activa={filtros.tipo === "anuladas"}
            onClick={() => ir({ tipo: "anuladas" })}
          />
        </div>
        <DonaMetodos metodos={resumen.metodos} />
      </div>
      <section
        aria-label="Pagos"
        aria-busy={cargando}
        className={cn(
          "rounded-lg border border-ac-borde bg-ac-papel p-4 shadow-quieta transition-opacity",
          cargando && "opacity-60",
        )}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <FiltroPeriodo
            id="pagos-periodo"
            valor={filtros}
            hoy={hoy}
            onCambio={(p) => ir(p)}
          />
          <CampoBuscar
            valor={filtros.q}
            etiqueta="Venta, comprobante o cliente"
            onBuscar={(q) => ir({ q })}
          />
          <select
            aria-label="Método de pago"
            className={SELECTOR}
            value={filtros.metodo}
            onChange={(e) => ir({ metodo: e.target.value })}
          >
            <option value="">Todos los métodos</option>
            {metodos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4">
          {total === 0 ? (
            <Vacio
              icono={conFiltros ? Search : ArrowLeftRight}
              titulo={
                conFiltros
                  ? "Ningún pago coincide"
                  : "Sin pagos en este período"
              }
              texto={
                conFiltros
                  ? "Cambia el período o quita algún filtro."
                  : "Los pagos aparecen aquí al cobrar una venta."
              }
            />
          ) : (
            <>
              <p className="cifras pb-2 text-right text-[13px] text-ac-pizarra">
                Mostrando {filas.length} de {total} pagos
              </p>
              <ListaMovil filas={filas} />
              <Tabla filas={filas} />
              <Paginacion
                pagina={filtros.pagina}
                total={total}
                porPagina={filtros.por}
                onPagina={(pagina) => ir({ pagina })}
                onPorPagina={(por) => ir({ por })}
              />
            </>
          )}
        </div>
      </section>
    </main>
  );
}
