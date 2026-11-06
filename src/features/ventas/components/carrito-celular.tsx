"use client";

import { useState } from "react";
import {
  AlertCircle,
  BadgePercent,
  Plus,
  ReceiptText,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { pesos } from "@/shared/lib/formato";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import type { FlujoVenta } from "../hooks/use-flujo-venta";
import type { DatosPanel } from "../types";
import { CatalogoVenta } from "./catalogo-venta";
import { HojaDescuento } from "./hoja-descuento";
import { FilaItem } from "./resumen-venta";

function Cuadro({
  icono: Icono,
  titulo,
  detalle,
  disabled,
  onClick,
}: {
  icono: LucideIcon;
  titulo: string;
  detalle: string | null;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // Con valor se ve solo el valor; el nombre sigue diciendo qué es.
      aria-label={detalle ? `${titulo}: ${detalle}` : titulo}
      className={cn(
        "flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-1.5 text-sm font-medium disabled:opacity-40",
        detalle
          ? "border-ac-laguna bg-ac-laguna-claro text-ac-laguna-hondo"
          : "border-ac-borde bg-ac-papel",
      )}
    >
      <Icono className="h-5 w-5" aria-hidden="true" />
      <span className="max-w-full truncate">{detalle ?? titulo}</span>
    </button>
  );
}

/** El catálogo del celular como subpantalla, con "Ir al carrito (N)" fijo abajo. */
function CatalogoCelular({ f, datos }: { f: FlujoVenta; datos: DatosPanel }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col p-4">
      <CatalogoVenta
        datos={datos}
        pestana={f.pestana}
        onPestana={f.setPestana}
        onAgregar={f.agregar}
        onAgregarProducto={f.agregarProducto}
        onAgregarExtra={f.agregarExtra}
        onItemLibre={f.agregarLibre}
        cliente={f.cliente}
        onCliente={f.elegirCliente}
        descuento={f.descuento}
        onDescuento={f.setDescuento}
      />
      {f.error ? (
        <p role="alert" className="mt-2 text-sm text-ac-error">
          {f.error}
        </p>
      ) : null}
      <Button
        size="lg"
        className="mt-3 w-full rounded-full"
        onClick={() => f.setMovil("venta")}
      >
        Ir al carrito ({f.items.length})
      </Button>
    </div>
  );
}

/**
 * Nueva venta del celular (T-12.11): el carrito a pantalla completa. Vacío invita a agregar; abajo, Cliente,
 * Descuento, el total y "Elegir cómo pagar". El catálogo de la tableta es la subpantalla "Agregar al carrito".
 */
export function CarritoCelular({
  f,
  datos,
}: {
  f: FlujoVenta;
  datos: DatosPanel;
}) {
  const [hojaDescuento, setHojaDescuento] = useState(false);
  if (f.movil === "catalogo") return <CatalogoCelular f={f} datos={datos} />;
  const total = f.sub - f.desc;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {datos.avisos.map((a) => (
          <p
            key={a}
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-md bg-ac-aviso/10 px-3 py-2 text-sm text-ac-aviso"
          >
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            {a}
          </p>
        ))}
        {f.items.length ? (
          <>
            <ul aria-label="Ítems de la venta">
              {f.items.map((i) => (
                <FilaItem
                  key={i.clave}
                  item={i}
                  profesionales={datos.profesionales}
                  onCambio={(c) => f.cambiarItem(i.clave, c)}
                  onQuitar={() => f.quitarItem(i.clave)}
                />
              ))}
            </ul>
            <Button
              variant="outline"
              className="mt-2 w-full"
              onClick={() => f.verCatalogo("items")}
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Agregar al carrito
            </Button>
          </>
        ) : (
          <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 text-center">
            <span className="inline-flex h-[72px] w-[72px] items-center justify-center rounded-full bg-ac-laguna-claro text-ac-laguna-hondo">
              <ReceiptText className="h-8 w-8" aria-hidden="true" />
            </span>
            <p className="text-lg font-bold">Carrito vacío</p>
            <p className="max-w-xs text-sm text-ac-pizarra">
              Agrega un servicio, un producto, un plan o una gift card para
              empezar a cobrar.
            </p>
            <Button variant="outline" onClick={() => f.verCatalogo("items")}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Agregar al carrito
            </Button>
          </div>
        )}
      </div>
      <div className="space-y-3 border-t border-ac-borde px-4 pb-4 pt-3">
        <div className="grid grid-cols-2 gap-2">
          <Cuadro
            icono={UserRound}
            titulo={
              datos.clienteObligatorio ? "Cliente (obligatorio)" : "Cliente"
            }
            detalle={
              f.cliente ? `${f.cliente.nombre} ${f.cliente.apellido}` : null
            }
            onClick={() => f.verCatalogo("clientes")}
          />
          <Cuadro
            icono={BadgePercent}
            titulo="Descuento"
            detalle={f.desc ? `−${pesos(f.desc)}` : null}
            disabled={!f.items.length}
            onClick={() => setHojaDescuento(true)}
          />
        </div>
        <p className="flex items-center justify-between">
          <span className="text-ac-pizarra">Total</span>
          <span className="cifras text-2xl font-bold">{pesos(total)}</span>
        </p>
        {f.error ? (
          <p
            role="alert"
            className="flex items-center gap-1 text-sm text-ac-error"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {f.error}
          </p>
        ) : null}
        <Button
          size="lg"
          className="w-full rounded-full disabled:bg-ac-niebla-oscura disabled:text-ac-pizarra disabled:opacity-100"
          disabled={!f.items.length}
          onClick={f.continuar}
        >
          Elegir cómo pagar
        </Button>
      </div>
      <HojaDescuento
        abierta={hojaDescuento}
        onCambiar={setHojaDescuento}
        descuento={f.descuento}
        subtotal={f.sub}
        onAplicar={f.setDescuento}
      />
    </div>
  );
}
