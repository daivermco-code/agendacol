"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarCheck,
  CalendarX,
  CircleDollarSign,
  Wallet,
} from "lucide-react";
import { ESTADOS, ORDEN_ESTADOS } from "@/features/agenda/lib/estados";
import { PildoraVenta } from "@/features/ventas/components/pildora-venta";
import { usePanelVenta } from "@/features/ventas/store/panel-venta";
import { Vacio } from "@/shared/components/vacio";
import { pesos } from "@/shared/lib/formato";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import type { CitaFicha, VentaFicha } from "../services/clientes";

const dia = (f: string) => format(parseISO(f), "d MMM yyyy", { locale: es });

export function PildoraEstado({ estado }: { estado: CitaFicha["estado"] }) {
  const e = ESTADOS[estado];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: e.fondo, color: e.texto }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: e.borde }}
        aria-hidden="true"
      />
      {e.nombre}
    </span>
  );
}

const PAGO: Record<
  NonNullable<CitaFicha["pago"]>,
  { nombre: string; clase: string }
> = {
  pagada: { nombre: "Pagada", clase: "text-ac-exito" },
  parcial: { nombre: "Pago parcial", clase: "text-ac-aviso" },
  pendiente: { nombre: "Sin pagar", clase: "text-ac-error" },
};

/** Contadores por estado (con "n pagadas" en Asiste) y la tabla de reservas. */
export function Actividad({ citas }: { citas: CitaFicha[] }) {
  if (!citas.length)
    return (
      <Vacio
        icono={CalendarCheck}
        titulo="Todavía no tiene reservas"
        texto="Cuando reserve, aquí verás cada cita con su estado y su pago."
      />
    );
  const cuenta = (e: CitaFicha["estado"]) =>
    citas.filter((c) => c.estado === e).length;
  const pagadas = citas.filter((c) => c.pago === "pagada").length;
  return (
    <div className="space-y-4">
      <ul className="flex flex-wrap gap-2" aria-label="Reservas por estado">
        {ORDEN_ESTADOS.filter((e) => cuenta(e) > 0).map((e) => (
          <li
            key={e}
            className="rounded-lg border border-ac-borde bg-ac-papel px-3 py-2 text-sm"
            style={{ borderLeft: `4px solid ${ESTADOS[e].borde}` }}
          >
            <span className="cifras block text-lg font-bold leading-tight">
              {cuenta(e)}
            </span>
            {ESTADOS[e].nombre}
            {e === "asiste" ? (
              <span className="block text-xs text-ac-exito">
                {pagadas} {pagadas === 1 ? "pagada" : "pagadas"}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {/* Se desplaza de lado en celular: con foco, también con las flechas del teclado. */}
      <div
        className="overflow-x-auto rounded-lg border border-ac-borde"
        tabIndex={0}
        role="region"
        aria-label="Citas del cliente"
      >
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-ac-niebla text-left">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">
                Fecha
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Servicio
              </th>
              <th
                scope="col"
                className="hidden px-3 py-2 font-semibold sm:table-cell"
              >
                Profesional
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Estado
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">
                Precio
              </th>
              <th
                scope="col"
                className="hidden px-3 py-2 font-semibold md:table-cell"
              >
                Pago
              </th>
            </tr>
          </thead>
          <tbody>
            {citas.map((c) => (
              <tr key={c.id} className="border-t border-ac-borde">
                <td className="cifras whitespace-nowrap px-3 py-2">
                  {dia(c.fecha)} · {c.horaInicio}
                </td>
                <td className="px-3 py-2">{c.servicio}</td>
                <td className="hidden px-3 py-2 sm:table-cell">
                  {c.profesional}
                </td>
                <td className="px-3 py-2">
                  <PildoraEstado estado={c.estado} />
                </td>
                <td className="cifras px-3 py-2 text-right">
                  {pesos(c.precio)}
                </td>
                <td
                  className={cn(
                    "hidden px-3 py-2 md:table-cell",
                    c.pago && PAGO[c.pago].clase,
                  )}
                >
                  {c.pago ? PAGO[c.pago].nombre : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Cifra({
  titulo,
  valor,
  detalle,
}: {
  titulo: string;
  valor: string;
  detalle?: string;
}) {
  return (
    <div className="rounded-lg border border-ac-borde bg-ac-papel p-4">
      <p className="text-sm text-ac-pizarra">{titulo}</p>
      <p className="cifras mt-1 text-2xl font-bold">{valor}</p>
      {detalle ? (
        <p className="mt-0.5 text-xs text-ac-pizarra">{detalle}</p>
      ) : null}
    </div>
  );
}

/** Cuántas veces vino, cuántas faltó, la última visita y la próxima reserva. */
export function Asistencia({
  citas,
  hoy,
}: {
  citas: CitaFicha[];
  hoy: string;
}) {
  const vino = citas.filter((c) => c.estado === "asiste");
  const falto = citas.filter((c) => c.estado === "no_asistio");
  const cancelo = citas.filter((c) => c.estado === "cancelado").length;
  const cerradas = vino.length + falto.length;
  const proxima = [...citas]
    .filter(
      (c) =>
        c.fecha >= hoy && c.estado !== "cancelado" && c.estado !== "asiste",
    )
    .sort((a, b) =>
      (a.fecha + a.horaInicio).localeCompare(b.fecha + b.horaInicio),
    )[0];
  if (!citas.length)
    return (
      <Vacio
        icono={CalendarX}
        titulo="Sin asistencia que mostrar"
        texto="La asistencia se calcula con las citas atendidas y las faltas."
      />
    );
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Cifra
        titulo="Asistencia"
        valor={
          cerradas ? `${Math.round((vino.length / cerradas) * 100)} %` : "—"
        }
        detalle={`${vino.length} de ${cerradas} citas atendidas`}
      />
      <Cifra
        titulo="No asistió"
        valor={String(falto.length)}
        detalle={`${cancelo} canceladas`}
      />
      <Cifra
        titulo="Última visita"
        valor={vino[0] ? dia(vino[0].fecha) : "—"}
        detalle={vino[0]?.servicio}
      />
      <Cifra
        titulo="Próxima reserva"
        valor={proxima ? dia(proxima.fecha) : "—"}
        detalle={
          proxima
            ? `${proxima.horaInicio} · ${proxima.servicio}`
            : "Sin reservas próximas"
        }
      />
    </div>
  );
}

/** Lo pagado, lo que debe (saldos y citas atendidas sin cobrar) y sus ventas, con "Cobrar". */
export function PagosDeudas({
  clienteId,
  citas,
  ventas,
  puedeCobrar,
}: {
  clienteId: string;
  citas: CitaFicha[];
  ventas: VentaFicha[];
  puedeCobrar: boolean;
}) {
  const abrir = usePanelVenta((s) => s.abrir);
  const ver = usePanelVenta((s) => s.ver);
  const vigentes = ventas.filter((v) => v.estado !== "anulada");
  const pagado = vigentes.reduce((s, v) => s + v.pagado, 0);
  const sinCobrar = citas.filter(
    (c) => c.pago === "pendiente" && c.estado === "asiste",
  );
  const saldos = vigentes.filter((v) => v.estado === "parcial");
  const deuda =
    saldos.reduce((s, v) => s + v.total - v.pagado, 0) +
    sinCobrar.reduce((s, c) => s + c.precio, 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Cifra
          titulo="Total pagado"
          valor={pesos(pagado)}
          detalle={`${vigentes.length} ventas`}
        />
        <Cifra
          titulo="Debe"
          valor={pesos(deuda)}
          detalle={`${saldos.length} saldos · ${sinCobrar.length} citas sin cobrar`}
        />
        <Cifra
          titulo="Ticket promedio"
          valor={
            vigentes.length ? pesos(Math.round(pagado / vigentes.length)) : "—"
          }
        />
      </div>
      {puedeCobrar && (sinCobrar.length > 0 || saldos.length > 0) ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ac-aviso/40 bg-ac-aviso/10 p-3 text-sm">
          <Wallet className="h-4 w-4 text-ac-aviso" aria-hidden="true" />
          <span className="flex-1">Tiene pagos pendientes.</span>
          {sinCobrar.length ? (
            <Button
              size="sm"
              onClick={() =>
                abrir({ clienteId, citaIds: sinCobrar.map((c) => c.id) })
              }
            >
              Cobrar{" "}
              {sinCobrar.length === 1 ? "la cita" : `${sinCobrar.length} citas`}
            </Button>
          ) : null}
          {saldos.map((v) => (
            <Button
              key={v.id}
              size="sm"
              variant="outline"
              onClick={() => abrir({ ventaId: v.id })}
            >
              Pagar saldo de la {v.numero}
            </Button>
          ))}
        </div>
      ) : null}
      {ventas.length ? (
        <div
          className="overflow-x-auto rounded-lg border border-ac-borde"
          tabIndex={0}
          role="region"
          aria-label="Ventas del cliente"
        >
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-ac-niebla text-left">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Venta
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Fecha
                </th>
                <th
                  scope="col"
                  className="hidden px-3 py-2 font-semibold md:table-cell"
                >
                  Detalle
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">
                  Total
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">
                  Saldo
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id} className="border-t border-ac-borde">
                  <td className="cifras px-3 py-2 font-medium">
                    <button
                      type="button"
                      className="area-tactil text-ac-laguna-hondo hover:underline"
                      onClick={() => ver(v.id)}
                    >
                      {v.numero}
                    </button>
                  </td>
                  <td className="cifras whitespace-nowrap px-3 py-2">
                    {dia(v.fecha)}
                  </td>
                  <td className="hidden max-w-[260px] truncate px-3 py-2 md:table-cell">
                    {v.detalle}
                  </td>
                  <td className="cifras px-3 py-2 text-right">
                    {pesos(v.total)}
                  </td>
                  <td className="cifras px-3 py-2 text-right">
                    {v.estado === "parcial" ? pesos(v.total - v.pagado) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <PildoraVenta estado={v.estado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Vacio
          icono={CircleDollarSign}
          titulo="Sin ventas todavía"
          texto="Las ventas de este cliente aparecen aquí cuando se cobran sus citas."
        />
      )}
    </div>
  );
}
