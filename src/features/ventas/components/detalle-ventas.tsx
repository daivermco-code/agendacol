"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  Ban,
  Eye,
  MoreVertical,
  Plus,
  Receipt,
  Search,
  Wallet,
} from "lucide-react";
import { usePuede } from "@/features/auth/components/proveedor-miembro";
import { BotonExportar } from "@/shared/components/boton-exportar";
import { EditarColumnas } from "@/shared/components/editar-columnas";
import { Paginacion } from "@/shared/components/paginacion";
import { Vacio } from "@/shared/components/vacio";
import { useColumnas } from "@/shared/hooks/use-columnas";
import { enlaceExportar, type ColumnaListado } from "@/shared/lib/csv";
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
import { COLUMNAS_VENTAS } from "../lib/columnas";
import type { FiltrosVentas, FilaVenta, Tarjeta } from "../services/ventas";
import { usePanelVenta } from "../store/panel-venta";
import { PildoraVenta } from "./pildora-venta";
import {
  CampoBuscar,
  Encabezado,
  FiltroPeriodo,
  SELECTOR,
  TarjetaFiltro,
} from "./piezas-listado";

const fechaHora = (f: string) =>
  format(parseISO(f), "d MMM yyyy · HH:mm", { locale: es });

function Opciones({ v }: { v: FilaVenta }) {
  const puedo = usePuede();
  const { ver, abrir } = usePanelVenta();
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        size="icon"
        variant="outline"
        className="md:h-8 md:w-8"
        aria-label={`Ver la venta ${v.numero}`}
        onClick={() => ver(v.id)}
      >
        <Eye className="h-4 w-4 text-ac-laguna" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="md:h-8 md:w-8"
            aria-label={`Más opciones de la venta ${v.numero}`}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => ver(v.id)}>
            <Eye className="h-4 w-4" aria-hidden="true" /> Ver venta
          </DropdownMenuItem>
          {v.estado === "parcial" && puedo("cobrar") ? (
            <DropdownMenuItem onSelect={() => abrir({ ventaId: v.id })}>
              <Wallet className="h-4 w-4" aria-hidden="true" /> Pagar saldo
            </DropdownMenuItem>
          ) : null}
          {v.estado !== "anulada" && puedo("anular_venta") ? (
            <DropdownMenuItem
              className="text-ac-error"
              onSelect={() => ver(v.id)}
            >
              <Ban className="h-4 w-4" aria-hidden="true" /> Anular…
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** En el celular la tabla no cabe: cada venta va en dos líneas, con sus opciones al lado. */
function ListaMovil({ filas }: { filas: FilaVenta[] }) {
  return (
    <ul className="divide-y divide-ac-borde rounded-lg border border-ac-borde sm:hidden">
      {filas.map((v) => (
        <li
          key={v.id}
          className={cn(
            "flex items-center gap-2 py-2.5 pl-3 pr-1.5 text-sm",
            v.estado === "anulada" && "text-ac-pizarra",
          )}
        >
          <div className="min-w-0 flex-1 space-y-1">
            <p className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium">
                <span className="cifras">{v.numero}</span> · {v.cliente}
              </span>
              <span
                className={cn(
                  "cifras shrink-0 font-medium",
                  v.estado === "anulada" && "line-through",
                )}
              >
                {pesos(v.total)}
              </span>
            </p>
            <p className="flex items-center justify-between gap-2 text-xs text-ac-pizarra">
              <span className="flex min-w-0 items-center gap-2">
                <span className="cifras truncate">{fechaHora(v.fecha)}</span>
                <PildoraVenta estado={v.estado} />
              </span>
              {v.estado === "parcial" ? (
                <span className="cifras shrink-0 text-ac-aviso">
                  saldo {pesos(v.total - v.pagado)}
                </span>
              ) : null}
            </p>
          </div>
          <Opciones v={v} />
        </li>
      ))}
    </ul>
  );
}

type ClaveVenta = (typeof COLUMNAS_VENTAS)[number]["clave"];

/** Celdas de cada columna: clase del encabezado y de la celda, y lo que muestra. */
const CELDAS: Record<
  ClaveVenta,
  {
    /** Desde qué ancho se ve (encabezado y celda). */
    desde?: string;
    clase?: string;
    derecha?: boolean;
    valor: (v: FilaVenta) => React.ReactNode;
  }
> = {
  numero: { valor: (v) => <span className="font-medium">{v.numero}</span> },
  fecha: { clase: "whitespace-nowrap", valor: (v) => fechaHora(v.fecha) },
  total: {
    derecha: true,
    valor: (v) => (
      <>
        <span className={cn(v.estado === "anulada" && "line-through")}>
          {pesos(v.total)}
        </span>
        {v.estado === "parcial" ? (
          <span className="block text-xs text-ac-aviso">
            saldo {pesos(v.total - v.pagado)}
          </span>
        ) : null}
      </>
    ),
  },
  pagado: { derecha: true, valor: (v) => pesos(v.pagado) },
  saldo: {
    derecha: true,
    valor: (v) => (v.estado === "anulada" ? "—" : pesos(v.total - v.pagado)),
  },
  cliente: { clase: "max-w-[180px] truncate", valor: (v) => v.cliente },
  metodos: {
    desde: "hidden lg:table-cell",
    clase: "max-w-[200px] truncate",
    valor: (v) => v.metodos,
  },
  estado: {
    desde: "hidden md:table-cell",
    valor: (v) => <PildoraVenta estado={v.estado} />,
  },
};
const NUMERICAS: ClaveVenta[] = ["numero", "fecha", "total", "pagado", "saldo"];

function Tabla({
  filas,
  columnas,
}: {
  filas: FilaVenta[];
  columnas: readonly ColumnaListado[];
}) {
  const claves = columnas.map((c) => c.clave as ClaveVenta);
  return (
    <div className="hidden overflow-hidden rounded-lg border border-ac-borde sm:block">
      <table className="w-full text-sm">
        <thead className="bg-ac-niebla text-left">
          <tr>
            {columnas.map((c) => {
              const celda = CELDAS[c.clave as ClaveVenta];
              return (
                <th
                  key={c.clave}
                  scope="col"
                  className={cn(
                    "px-3 py-2.5 font-semibold",
                    celda.derecha && "text-right",
                    celda.desde,
                  )}
                >
                  {c.nombre}
                </th>
              );
            })}
            <th scope="col" className="w-24 px-3 py-2.5">
              <span className="sr-only">Opciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((v) => (
            <tr
              key={v.id}
              className={cn(
                "border-t border-ac-borde",
                v.estado === "anulada" && "text-ac-pizarra",
              )}
            >
              {claves.map((k) => (
                <td
                  key={k}
                  className={cn(
                    "px-3 py-2.5",
                    NUMERICAS.includes(k) && "cifras",
                    CELDAS[k].derecha && "text-right",
                    CELDAS[k].desde,
                    CELDAS[k].clase,
                  )}
                >
                  {CELDAS[k].valor(v)}
                </td>
              ))}
              <td className="px-3 py-1.5">
                <Opciones v={v} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Detalle de ventas: tarjetas que filtran, filtros, tabla y páginas (US-041). */
export function DetalleVentas({
  filas,
  total,
  resumen,
  filtros,
  porDefecto,
  metodos,
  hoy,
}: {
  filas: FilaVenta[];
  total: number;
  resumen: Record<"todas" | "parciales" | "anuladas", Tarjeta>;
  filtros: FiltrosVentas;
  porDefecto: FiltrosVentas;
  metodos: { id: string; nombre: string }[];
  hoy: string;
}) {
  const puedo = usePuede();
  const abrir = usePanelVenta((s) => s.abrir);
  const { ir, cargando } = useFiltrosUrl(filtros, porDefecto);
  const columnas = useColumnas("ventas", COLUMNAS_VENTAS);
  const conFiltros =
    filtros.q !== "" || filtros.metodo !== "" || filtros.estado !== "";
  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-4 lg:px-6 lg:py-6">
      <Encabezado
        titulo="Detalle de ventas"
        texto="Cada venta con su número, cliente y estado de pago."
      >
        <div className="hidden sm:block">
          <EditarColumnas
            todas={COLUMNAS_VENTAS}
            visibles={columnas.visibles}
            onCambio={columnas.cambiar}
          />
        </div>
        <BotonExportar
          href={enlaceExportar("ventas", filtros, columnas.visibles)}
        />
        {puedo("cobrar") ? (
          <Button onClick={() => abrir()} data-guia="venta">
            <Plus className="h-4 w-4" aria-hidden="true" /> Nueva venta
          </Button>
        ) : null}
      </Encabezado>
      <div className="grid gap-3 sm:grid-cols-3" aria-label="Resumen de ventas">
        <TarjetaFiltro
          titulo="Todas"
          n={resumen.todas.n}
          monto={resumen.todas.monto}
          activa={filtros.estado === ""}
          onClick={() => ir({ estado: "" })}
        />
        <TarjetaFiltro
          titulo="Pagos parciales"
          tono="aviso"
          n={resumen.parciales.n}
          monto={resumen.parciales.monto}
          activa={filtros.estado === "parcial"}
          onClick={() => ir({ estado: "parcial" })}
        />
        <TarjetaFiltro
          titulo="Anuladas"
          tono="neutro"
          n={resumen.anuladas.n}
          monto={resumen.anuladas.monto}
          activa={filtros.estado === "anulada"}
          onClick={() => ir({ estado: "anulada" })}
        />
      </div>
      <section
        aria-label="Ventas"
        aria-busy={cargando}
        className={cn(
          "rounded-lg border border-ac-borde bg-ac-papel p-4 shadow-quieta transition-opacity",
          cargando && "opacity-60",
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FiltroPeriodo
            id="ventas-periodo"
            valor={filtros}
            hoy={hoy}
            onCambio={(p) => ir(p)}
          />
          <CampoBuscar
            valor={filtros.q}
            etiqueta="Número o cliente"
            onBuscar={(q) => ir({ q })}
          />
          <select
            aria-label="Estado"
            className={SELECTOR}
            value={filtros.estado}
            onChange={(e) =>
              ir({ estado: e.target.value as FiltrosVentas["estado"] })
            }
          >
            <option value="">Todos los estados</option>
            <option value="pagada">Pagadas</option>
            <option value="parcial">Pago parcial</option>
            <option value="anulada">Anuladas</option>
          </select>
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
            conFiltros ? (
              <Vacio
                icono={Search}
                titulo="Ninguna venta coincide"
                texto="Cambia el período o quita algún filtro."
              />
            ) : (
              <Vacio
                icono={Receipt}
                titulo="Sin ventas en este período"
                texto="Las ventas aparecen aquí al cobrar una cita o una venta nueva."
              />
            )
          ) : (
            <>
              <p className="cifras pb-2 text-right text-[13px] text-ac-pizarra">
                Mostrando {filas.length} de {total} ventas
              </p>
              <ListaMovil filas={filas} />
              <Tabla filas={filas} columnas={columnas.visibles} />
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
