"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Hoja } from "@/shared/components/hoja";
import { pesos } from "@/shared/lib/formato";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { descuentoEnPesos, leerPesos } from "../lib/venta";
import type { Descuento } from "./catalogo-venta";

const MODOS = [
  { id: "porcentaje", nombre: "Porcentaje" },
  { id: "pesos", nombre: "Monto fijo" },
] as const;

function revisar(modo: Descuento["modo"], valor: number, sub: number) {
  if (modo === "porcentaje" && valor > 100)
    return "El porcentaje va de 0 a 100";
  if (modo === "pesos" && valor > sub)
    return "El descuento no puede pasar el subtotal";
  return null;
}

function Formulario({
  descuento,
  subtotal,
  onAplicar,
}: {
  descuento: Descuento;
  subtotal: number;
  onAplicar: (d: Descuento) => void;
}) {
  const [modo, setModo] = useState<Descuento["modo"]>(
    descuento.valor ? descuento.modo : "porcentaje",
  );
  const [texto, setTexto] = useState(
    descuento.valor ? String(descuento.valor) : "",
  );
  const valor = leerPesos(texto) ?? 0;
  const error = revisar(modo, valor, subtotal);
  const enPesos = error ? 0 : descuentoEnPesos(subtotal, modo, valor);
  const porcentaje = subtotal ? Math.round((enPesos * 100) / subtotal) : 0;
  return (
    <div className="space-y-4">
      <div
        role="radiogroup"
        aria-label="Tipo de descuento"
        className="grid grid-cols-2 rounded-full bg-ac-niebla p-1"
      >
        {MODOS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={modo === m.id}
            onClick={() => {
              setModo(m.id);
              setTexto("");
            }}
            className={cn(
              "min-h-11 rounded-full text-sm font-semibold",
              modo === m.id
                ? "bg-ac-papel text-ac-tinta shadow-sm"
                : "text-ac-pizarra",
            )}
          >
            {m.nombre}
          </button>
        ))}
      </div>
      <Input
        aria-label={
          modo === "pesos" ? "Descuento en pesos" : "Descuento en porcentaje"
        }
        inputMode="numeric"
        value={texto}
        placeholder={modo === "pesos" ? "$0" : "0 %"}
        onChange={(e) => setTexto(e.target.value)}
        className="cifras text-lg"
      />
      {error ? (
        <p
          role="alert"
          className="flex items-center gap-1 text-sm text-ac-error"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
      <dl className="space-y-1.5 rounded-lg bg-ac-niebla px-4 py-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-ac-pizarra">Subtotal</dt>
          <dd className="cifras">{pesos(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ac-pizarra">Descuento ({porcentaje} %)</dt>
          <dd className="cifras">−{pesos(enPesos)}</dd>
        </div>
        <div className="flex justify-between font-semibold">
          <dt>Total con descuento</dt>
          <dd className="cifras">{pesos(subtotal - enPesos)}</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          className="rounded-full"
          disabled={error !== null}
          onClick={() => onAplicar({ modo, valor })}
        >
          Aplicar descuento
        </Button>
        {descuento.valor ? (
          <Button
            variant="ghost"
            onClick={() => onAplicar({ modo: "pesos", valor: 0 })}
          >
            Quitar descuento
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Descuento a toda la venta en el celular: Porcentaje o Monto fijo, con el resumen antes de aplicarlo. */
export function HojaDescuento({
  abierta,
  onCambiar,
  descuento,
  subtotal,
  onAplicar,
}: {
  abierta: boolean;
  onCambiar: (abierta: boolean) => void;
  descuento: Descuento;
  subtotal: number;
  onAplicar: (d: Descuento) => void;
}) {
  return (
    <Hoja abierta={abierta} onCambiar={onCambiar} titulo="Descuento">
      {abierta ? (
        <Formulario
          descuento={descuento}
          subtotal={subtotal}
          onAplicar={(d) => {
            onAplicar(d);
            onCambiar(false);
          }}
        />
      ) : null}
    </Hoja>
  );
}
