"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertCircle,
  Minus,
  Plus,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";
import type { ClienteResumen } from "@/features/clientes/schemas";
import { pesos } from "@/shared/lib/formato";
import { cn, iniciales } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { leerPesos } from "../lib/venta";
import type { DatosPanel, ItemPanel } from "../types";

const SELECTOR =
  "h-11 min-w-0 flex-1 rounded-md border border-input bg-ac-papel px-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring md:h-8";

function TarjetaClienteVenta({
  cliente,
  obligatorio,
  onCambiar,
}: {
  cliente: ClienteResumen | null;
  obligatorio: boolean;
  onCambiar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCambiar}
      className="flex w-full items-center gap-3 rounded-lg border border-ac-borde bg-ac-papel p-3 text-left hover:bg-ac-niebla"
    >
      {cliente ? (
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ac-laguna-claro text-sm font-bold text-ac-laguna-hondo">
          {iniciales(cliente.nombre, cliente.apellido)}
        </span>
      ) : (
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ac-niebla text-ac-pizarra">
          <UserRound className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">
          {cliente ? `${cliente.nombre} ${cliente.apellido}` : "Sin cliente"}
        </span>
        <span className="block text-xs text-ac-pizarra">
          {cliente
            ? "Cambiar cliente"
            : obligatorio
              ? "Elige el cliente (obligatorio)"
              : "Elegir cliente (opcional)"}
        </span>
      </span>
    </button>
  );
}

export function FilaItem({
  item,
  profesionales,
  onCambio,
  onQuitar,
}: {
  item: ItemPanel;
  profesionales: DatosPanel["profesionales"];
  onCambio: (cambio: Partial<ItemPanel>) => void;
  onQuitar: () => void;
}) {
  const cuando = item.fecha
    ? `${format(parseISO(item.fecha), "d MMM", { locale: es })}${item.hora ? ` · ${item.hora}` : ""}`
    : null;
  return (
    <li className="space-y-2 border-b border-ac-borde py-3 last:border-b-0">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium">
          {item.descripcion}
          {cuando ? (
            <span className="block text-xs font-normal text-ac-pizarra">
              Cita del {cuando}
            </span>
          ) : null}
        </p>
        <span className="cifras text-sm font-semibold">
          {pesos(item.cantidad * item.precioUnitario)}
        </span>
        <button
          type="button"
          onClick={onQuitar}
          aria-label={`Quitar ${item.descripcion}`}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ac-pizarra hover:bg-ac-niebla md:h-7 md:w-7"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {item.citaId ? (
          <span className="cifras rounded-md bg-ac-niebla px-2 py-1 text-xs">
            × 1
          </span>
        ) : (
          <div className="inline-flex items-center rounded-md border border-ac-borde">
            <button
              type="button"
              aria-label="Una menos"
              disabled={item.cantidad <= 1}
              onClick={() => onCambio({ cantidad: item.cantidad - 1 })}
              className="inline-flex h-11 w-11 items-center justify-center disabled:opacity-40 md:h-8 md:w-8"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span
              className="cifras w-6 text-center text-sm"
              aria-label={`Cantidad ${item.cantidad}`}
            >
              {item.cantidad}
            </span>
            <button
              type="button"
              aria-label="Una más"
              disabled={item.cantidad >= 99}
              onClick={() => onCambio({ cantidad: item.cantidad + 1 })}
              className="inline-flex h-11 w-11 items-center justify-center disabled:opacity-40 md:h-8 md:w-8"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <Input
          aria-label={`Precio de ${item.descripcion}`}
          inputMode="numeric"
          value={pesos(item.precioUnitario)}
          onChange={(e) =>
            onCambio({
              precioUnitario: Math.min(
                leerPesos(e.target.value) ?? 0,
                100_000_000,
              ),
            })
          }
          className="cifras w-28 text-[13px] md:h-8"
        />
        <select
          aria-label={`Profesional de ${item.descripcion}`}
          className={SELECTOR}
          value={item.profesionalId ?? ""}
          onChange={(e) => onCambio({ profesionalId: e.target.value || null })}
        >
          <option value="">Sin profesional</option>
          {profesionales.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>
    </li>
  );
}

/** Columna "Nueva venta": cliente, ítems, descuento y total con Continuar. */
export function ResumenVenta(p: {
  datos: DatosPanel;
  items: ItemPanel[];
  cliente: ClienteResumen | null;
  subtotal: number;
  descuento: number;
  error: string | null;
  onCambiarCliente: () => void;
  onItem: (clave: string, cambio: Partial<ItemPanel>) => void;
  onQuitar: (clave: string) => void;
  onAgregarMovil: () => void;
  onContinuar: () => void;
}) {
  const total = p.subtotal - p.descuento;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <TarjetaClienteVenta
        cliente={p.cliente}
        obligatorio={p.datos.clienteObligatorio}
        onCambiar={p.onCambiarCliente}
      />
      {p.datos.avisos.map((a) => (
        <p
          key={a}
          role="alert"
          className="flex items-start gap-2 rounded-md bg-ac-aviso/10 px-3 py-2 text-sm text-ac-aviso"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {a}
        </p>
      ))}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {p.items.length ? (
          <ul aria-label="Ítems de la venta">
            {p.items.map((i) => (
              <FilaItem
                key={i.clave}
                item={i}
                profesionales={p.datos.profesionales}
                onCambio={(c) => p.onItem(i.clave, c)}
                onQuitar={() => p.onQuitar(i.clave)}
              />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-ac-pizarra">
            <ShoppingBag className="h-6 w-6" aria-hidden="true" />
            Agrega servicios desde la lista.
          </div>
        )}
        <Button
          variant="outline"
          className="mt-2 w-full md:hidden"
          onClick={p.onAgregarMovil}
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Agregar ítems
        </Button>
      </div>
      <div className="space-y-1.5 border-t border-ac-borde pt-3 text-sm">
        {p.descuento ? (
          <>
            <p className="flex justify-between text-ac-pizarra">
              <span>Subtotal</span>
              <span className="cifras">{pesos(p.subtotal)}</span>
            </p>
            <p className="flex justify-between text-ac-pizarra">
              <span>Descuento</span>
              <span className="cifras">−{pesos(p.descuento)}</span>
            </p>
          </>
        ) : null}
        <p className="flex items-center justify-between gap-3">
          <span className="text-base font-semibold">Total</span>
          <span
            className={cn(
              "cifras text-xl font-bold",
              total === 0 && "text-ac-pizarra",
            )}
          >
            {pesos(total)}
          </span>
        </p>
        {p.error ? (
          <p
            role="alert"
            className="flex items-center gap-1 text-xs text-ac-error"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {p.error}
          </p>
        ) : null}
        <Button
          className="w-full"
          size="lg"
          disabled={!p.items.length}
          onClick={p.onContinuar}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}
