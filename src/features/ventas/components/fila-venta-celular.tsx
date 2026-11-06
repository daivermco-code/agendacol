"use client";

import { Receipt } from "lucide-react";
import { pesos } from "@/shared/lib/formato";
import { cn } from "@/shared/lib/utils";
import {
  enBogota,
  metodoPrincipal,
  type GrupoDia,
  type PropinaCelular,
  type VentaCelular,
} from "../lib/lista-celular";
import { ICONO_METODO } from "../lib/metodos";
import { usePanelVenta } from "../store/panel-venta";
import type { TipoMetodo } from "../types";

const FILA =
  "flex min-h-[57px] w-full items-center gap-3 border-b border-ac-borde py-2 text-left hover:bg-ac-niebla";

function Circulo({ tipo }: { tipo: TipoMetodo | null }) {
  const Icono = tipo ? ICONO_METODO[tipo] : Receipt;
  return (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ac-laguna-claro text-ac-laguna-hondo">
      <Icono className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

/** Una venta: ícono del método, cliente, "hora · método", monto y número. Abre el detalle. */
export function FilaVentaCelular({ v }: { v: VentaCelular }) {
  const ver = usePanelVenta((s) => s.ver);
  const metodo = metodoPrincipal(v.pagos);
  const anulada = v.estado === "anulada";
  const saldo = v.estado === "parcial" ? v.total - v.pagado : 0;
  const cliente = v.cliente ?? "Sin cliente";
  return (
    <li>
      <button
        type="button"
        onClick={() => ver(v.id)}
        aria-label={`Ver la venta ${v.numero}: ${cliente}, ${enBogota(v.fecha).hora}, ${metodo.nombre}, ${pesos(v.total)}${
          anulada
            ? ", anulada"
            : saldo
              ? `, venta abonada, saldo pendiente ${pesos(saldo)}`
              : ""
        }`}
        className={FILA}
      >
        <Circulo tipo={metodo.tipo} />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-[16px] font-medium",
              anulada && "text-ac-pizarra line-through",
            )}
          >
            {cliente}
          </span>
          <span className="block truncate text-[13px] text-ac-pizarra">
            {`${enBogota(v.fecha).hora} · ${metodo.nombre}`}
          </span>
          {saldo ? (
            <span className="block text-[12px] font-semibold text-ac-aviso">
              {`Venta abonada · saldo ${pesos(saldo)}`}
            </span>
          ) : null}
          {anulada ? (
            <span className="block text-[12px] font-semibold text-ac-pizarra">
              Anulada
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-right">
          <span
            className={cn(
              "cifras block text-[16px] font-bold",
              anulada ? "text-ac-pizarra line-through" : "text-ac-laguna-hondo",
            )}
          >
            {pesos(v.total)}
          </span>
          <span className="cifras block text-[12px] text-ac-pizarra">
            {v.numero}
          </span>
        </span>
      </button>
    </li>
  );
}

/** Una propina: "+$X propina" con el cliente, la hora, el método y la venta. */
export function FilaPropinaCelular({ p }: { p: PropinaCelular }) {
  const ver = usePanelVenta((s) => s.ver);
  const cliente = p.cliente ?? "Sin cliente";
  return (
    <li>
      <button
        type="button"
        onClick={() => ver(p.ventaId)}
        aria-label={`Ver la venta ${p.numero}: propina de ${pesos(p.propina)}, ${cliente}, ${enBogota(p.fecha).hora}, ${p.metodo}`}
        className={FILA}
      >
        <Circulo tipo={p.tipo} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-medium">
            {cliente}
          </span>
          <span className="block truncate text-[13px] text-ac-pizarra">
            {`${enBogota(p.fecha).hora} · ${p.metodo}`}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="cifras block text-[16px] font-bold text-ac-laguna-hondo">
            {`+${pesos(p.propina)} propina`}
          </span>
          <span className="cifras block text-[12px] text-ac-pizarra">
            {p.numero}
          </span>
        </span>
      </button>
    </li>
  );
}

/** Cabecera de un día: fecha larga, "En curso" si es hoy y el total del día. */
export function CabeceraDia<T>({ g }: { g: GrupoDia<T> }) {
  return (
    <h3 className="flex items-center justify-between gap-2 pb-1 text-[14px] font-semibold text-ac-pizarra">
      <span className="min-w-0 first-letter:uppercase">{g.titulo}</span>
      <span className="flex shrink-0 items-center gap-2">
        {g.esHoy ? (
          <span className="rounded-full border border-ac-laguna/40 bg-ac-laguna-claro px-2 py-0.5 text-[12px] text-ac-laguna-hondo">
            En curso
          </span>
        ) : null}
        <span className="cifras text-ac-tinta">{pesos(g.total)}</span>
      </span>
    </h3>
  );
}
