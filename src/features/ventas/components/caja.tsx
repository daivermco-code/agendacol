"use client";

import { Fragment, useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  Landmark,
  Scale,
  Wallet,
} from "lucide-react";
import { Paginacion } from "@/shared/components/paginacion";
import { Vacio } from "@/shared/components/vacio";
import { pesos } from "@/shared/lib/formato";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { useFiltrosUrl } from "../hooks/use-filtros-url";
import { MOVIMIENTOS_POR_PAGINA, PESTANAS_CAJA } from "../lib/caja";
import type {
  FilaMovimiento,
  FiltrosCaja,
  ResumenCaja,
} from "../services/caja";
import { usePanelVenta } from "../store/panel-venta";
import { Encabezado, FiltroPeriodo, SELECTOR } from "./piezas-listado";
import { VentanaMovimiento, type TipoVentana } from "./ventana-movimiento";

const NOMBRE_PESTANA: Record<(typeof PESTANAS_CAJA)[number], string> = {
  "": "Todos",
  ventas: "Ventas y abonos",
  ingreso: "Ingresos",
  egreso: "Egresos",
  traspaso: "Traspasos",
  rectificacion: "Rectificaciones",
};

const NOMBRE_TIPO: Record<FilaMovimiento["tipo"], string> = {
  ingreso: "Ingreso",
  egreso: "Egreso",
  traspaso: "Traspaso",
  rectificacion: "Rectificación",
};

const conSigno = (n: number) =>
  `${n < 0 ? "−" : n > 0 ? "+" : ""}${pesos(Math.abs(n))}`;

/** La cuenta del período en cajas unidas por signos: ventas + abonos + ingresos − egresos − traspasos ± ajustes. */
function Cuenta({ r }: { r: ResumenCaja }) {
  const partes = [
    { nombre: "Ventas", valor: r.ventas, signo: "+" },
    { nombre: "Abonos", valor: r.abonos, signo: "+" },
    { nombre: "Ingresos", valor: r.ingresos, signo: "+" },
    { nombre: "Egresos", valor: r.egresos, signo: "−" },
    { nombre: "Traspasos", valor: r.traspasos, signo: "−" },
    {
      nombre: "Rectificaciones",
      valor: r.rectificaciones,
      signo: r.rectificaciones < 0 ? "−" : "+",
    },
  ];
  return (
    <>
      <dl className="cifras space-y-1.5 text-sm sm:hidden">
        {partes.map((p) => (
          <div key={p.nombre} className="flex justify-between gap-3">
            <dt className="text-ac-pizarra">{p.nombre}</dt>
            <dd>
              {p.signo} {pesos(Math.abs(p.valor))}
            </dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 border-t border-ac-borde pt-1.5 font-bold text-ac-laguna-hondo">
          <dt>Resultado</dt>
          <dd>{conSigno(r.resultado)}</dd>
        </div>
      </dl>
      <div className="hidden flex-wrap items-stretch gap-2 sm:flex">
        {partes.map((p, i) => (
          <Fragment key={p.nombre}>
            {i > 0 ? (
              <span
                className="self-center text-lg font-semibold text-ac-pizarra"
                aria-hidden="true"
              >
                {p.signo}
              </span>
            ) : null}
            <div className="min-w-[110px] flex-1 rounded-md border border-ac-borde bg-ac-papel px-3 py-2">
              <p className="text-xs text-ac-pizarra">{p.nombre}</p>
              <p className="cifras font-semibold">{pesos(Math.abs(p.valor))}</p>
            </div>
          </Fragment>
        ))}
        <span
          className="self-center text-lg font-semibold text-ac-pizarra"
          aria-hidden="true"
        >
          =
        </span>
        <div className="min-w-[130px] flex-1 rounded-md border border-ac-laguna bg-ac-laguna-claro px-3 py-2">
          <p className="text-xs text-ac-laguna-hondo">Resultado</p>
          <p className="cifras font-bold text-ac-laguna-hondo">
            {conSigno(r.resultado)}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-ac-pizarra">
        De ese resultado, en efectivo:{" "}
        <span className="cifras font-semibold text-ac-tinta">
          {conSigno(r.efectivoPeriodo)}
        </span>
        . Lo demás entró por tarjeta, transferencia o billetera.
      </p>
    </>
  );
}

function Tabla({ filas }: { filas: FilaMovimiento[] }) {
  const ver = usePanelVenta((s) => s.ver);
  return (
    <div className="overflow-hidden rounded-lg border border-ac-borde">
      <table className="w-full text-sm">
        <thead className="bg-ac-niebla text-left">
          <tr>
            <th scope="col" className="px-3 py-2.5 font-semibold">
              Fecha
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold">
              Concepto
            </th>
            <th
              scope="col"
              className="hidden px-3 py-2.5 font-semibold md:table-cell"
            >
              Tipo
            </th>
            <th
              scope="col"
              className="hidden px-3 py-2.5 font-semibold lg:table-cell"
            >
              Medio
            </th>
            <th
              scope="col"
              className="hidden px-3 py-2.5 font-semibold xl:table-cell"
            >
              Registró
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
              Monto
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((m) => (
            <tr key={m.id} className="border-t border-ac-borde">
              <td className="cifras whitespace-nowrap px-3 py-2.5">
                {format(parseISO(m.fecha), "d MMM · HH:mm", { locale: es })}
              </td>
              <td className="px-3 py-2.5">
                {m.ventaId ? (
                  <button
                    type="button"
                    className="area-tactil text-left text-ac-laguna-hondo hover:underline"
                    onClick={() => ver(m.ventaId)}
                  >
                    {m.concepto}
                  </button>
                ) : (
                  m.concepto
                )}
                {m.contado !== null ? (
                  <span className="cifras block text-xs text-ac-pizarra">
                    Contado: {pesos(m.contado)}
                  </span>
                ) : null}
              </td>
              <td className="hidden px-3 py-2.5 md:table-cell">
                {NOMBRE_TIPO[m.tipo]}
              </td>
              <td className="hidden px-3 py-2.5 lg:table-cell">
                {m.metodo ?? (m.efectivo ? "Efectivo" : "Otro medio")}
              </td>
              <td className="hidden px-3 py-2.5 xl:table-cell">
                {m.quien ?? "—"}
              </td>
              <td
                className={cn(
                  "cifras px-3 py-2.5 text-right font-medium",
                  m.monto < 0 ? "text-ac-error" : "text-ac-exito",
                )}
              >
                {conSigno(m.monto)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Caja de ventas: movimientos, rango de fechas, efectivo en caja, cuenta con signos y rectificar (US-043). */
export function Caja({
  filas,
  total,
  resumen,
  filtros,
  porDefecto,
  locales,
  hoy,
}: {
  filas: FilaMovimiento[];
  total: number;
  resumen: ResumenCaja;
  filtros: FiltrosCaja;
  porDefecto: FiltrosCaja;
  locales: { id: string; nombre: string }[];
  hoy: string;
}) {
  const { ir, cargando } = useFiltrosUrl(filtros, porDefecto);
  const [ventana, setVentana] = useState<TipoVentana | null>(null);
  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-4 lg:px-6 lg:py-6">
      <Encabezado
        titulo="Caja de ventas"
        texto="Lo que entra y sale de la caja, y el efectivo que debería haber."
      >
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />{" "}
                Ingresos
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => setVentana({ tipo: "ingreso", efectivo: true })}
              >
                Ingreso en efectivo
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  setVentana({ tipo: "ingreso", efectivo: false })
                }
              >
                Ingreso por otro medio
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            onClick={() => setVentana({ tipo: "egreso" })}
          >
            <ArrowUpFromLine className="h-4 w-4" aria-hidden="true" /> Egresos
          </Button>
          <Button
            variant="outline"
            onClick={() => setVentana({ tipo: "traspaso" })}
          >
            <Landmark className="h-4 w-4" aria-hidden="true" /> Traspasos
          </Button>
          <Button onClick={() => setVentana({ tipo: "rectificar" })}>
            <Scale className="h-4 w-4" aria-hidden="true" /> Rectificar efectivo
          </Button>
        </div>
      </Encabezado>
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="rounded-lg border border-ac-borde bg-ac-papel p-4 shadow-quieta">
            <p className="flex items-center gap-2 text-sm text-ac-pizarra">
              <Wallet className="h-4 w-4" aria-hidden="true" /> Efectivo en caja
            </p>
            <p className="cifras mt-1 text-3xl font-bold">
              {pesos(resumen.efectivoEnCaja)}
            </p>
            <p className="mt-1 text-xs text-ac-pizarra">
              Todo el efectivo registrado hasta ahora, sin importar el período.
            </p>
          </div>
          {locales.length > 1 ? (
            <select
              aria-label="Local"
              className={SELECTOR}
              value={filtros.local}
              onChange={(e) => ir({ local: e.target.value })}
            >
              {locales.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </select>
          ) : null}
          <FiltroPeriodo
            id="caja-periodo"
            valor={filtros}
            hoy={hoy}
            onCambio={(p) => ir(p)}
          />
        </div>
        <section
          aria-label="Cuenta del período"
          className="rounded-lg border border-ac-borde bg-ac-niebla/60 p-4"
        >
          <p className="mb-3 text-sm font-semibold">Cuenta del período</p>
          <Cuenta r={resumen} />
        </section>
      </div>
      <section
        aria-label="Movimientos"
        aria-busy={cargando}
        className={cn(
          "rounded-lg border border-ac-borde bg-ac-papel p-4 shadow-quieta transition-opacity",
          cargando && "opacity-60",
        )}
      >
        <div
          role="tablist"
          aria-label="Tipo de movimiento"
          className="-mx-1 flex gap-1 overflow-x-auto border-b border-ac-borde px-1"
        >
          {PESTANAS_CAJA.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={filtros.tipo === t}
              onClick={() => ir({ tipo: t })}
              className={cn(
                "-mb-px whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium md:py-2",
                filtros.tipo === t
                  ? "border-ac-laguna text-ac-laguna-hondo"
                  : "border-transparent text-ac-pizarra hover:text-ac-tinta",
              )}
            >
              {NOMBRE_PESTANA[t]}
            </button>
          ))}
        </div>
        <div className="mt-4">
          {total === 0 ? (
            <Vacio
              icono={Wallet}
              titulo="Sin movimientos"
              texto="No hay movimientos de este tipo en el período."
            />
          ) : (
            <>
              <Tabla filas={filas} />
              <Paginacion
                pagina={filtros.pagina}
                total={total}
                porPagina={MOVIMIENTOS_POR_PAGINA}
                onPagina={(pagina) => ir({ pagina })}
              />
            </>
          )}
        </div>
      </section>
      {ventana ? (
        <VentanaMovimiento
          ventana={ventana}
          localId={filtros.local}
          efectivoEnCaja={resumen.efectivoEnCaja}
          onCerrar={() => setVentana(null)}
        />
      ) : null}
    </main>
  );
}
