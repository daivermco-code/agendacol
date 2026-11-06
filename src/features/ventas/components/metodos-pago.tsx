"use client";

import { Trash2 } from "lucide-react";
import { Campo } from "@/shared/components/campo";
import { pesos } from "@/shared/lib/formato";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ICONO_METODO } from "../lib/metodos";
import { leerPesos, type LineaPago } from "../lib/venta";
import type { PagoVenta } from "../schemas";
import type { MetodoVenta } from "../types";

/** Piezas del cobro (US-039 y US-040): tarjetas de métodos, efectivo con vuelto, varios métodos y propina. */

export interface Fila {
  clave: number;
  metodoId: string;
  monto: string;
  recibido: string;
  comprobante: string;
}

const SELECTOR =
  "h-11 w-full rounded-md border border-input bg-ac-papel px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring md:h-9";

/** Billetes para pagar "redondo": los múltiplos de 10, 20, 50 y 100 mil por encima del monto. */
function billetes(monto: number): number[] {
  const opciones = [10_000, 20_000, 50_000, 100_000].map(
    (b) => Math.ceil(monto / b) * b,
  );
  return [...new Set(opciones)].filter((v) => v > monto).slice(0, 3);
}

/** Las filas del formulario como pagos. La propina va en el primer pago (con un solo método). */
export function aPagos(filas: Fila[], metodos: MetodoVenta[], propina = 0) {
  const tipo = (id: string) => metodos.find((m) => m.id === id)?.tipo;
  const elegidas = filas.filter((f) => f.metodoId);
  const lineas: LineaPago[] = elegidas.map((f, i) => ({
    monto: leerPesos(f.monto) ?? 0,
    recibido: tipo(f.metodoId) === "efectivo" ? leerPesos(f.recibido) : null,
    efectivo: tipo(f.metodoId) === "efectivo",
    propina: i === 0 ? propina : 0,
  }));
  // Con gift card, el campo del comprobante lleva su código.
  const pagos: PagoVenta[] = elegidas.map((f, i) => {
    const gift = tipo(f.metodoId) === "gift_card";
    const texto = f.comprobante.trim();
    return {
      metodoId: f.metodoId,
      monto: lineas[i].monto,
      recibido: lineas[i].recibido ?? null,
      comprobante: gift ? null : texto || null,
      propina: lineas[i].propina ?? 0,
      giftCard: gift ? texto.toUpperCase() || null : null,
    };
  });
  const sinCodigo = elegidas.some(
    (f) => tipo(f.metodoId) === "gift_card" && !f.comprobante.trim(),
  );
  return {
    lineas,
    pagos,
    sinMetodo: elegidas.length < filas.length,
    sinCodigo,
  };
}

export function Efectivo({
  fila,
  monto,
  propina,
  onCambio,
}: {
  fila: Fila;
  monto: number;
  propina: number;
  onCambio: (f: Partial<Fila>) => void;
}) {
  const cubre = monto + propina;
  const recibido = leerPesos(fila.recibido);
  const vuelto = recibido !== null && monto > 0 ? recibido - cubre : null;
  return (
    <div className="space-y-2">
      <Campo id={`recibido-${fila.clave}`} etiqueta="Monto recibido">
        <Input
          id={`recibido-${fila.clave}`}
          inputMode="numeric"
          value={fila.recibido}
          placeholder={pesos(cubre)}
          onChange={(e) => onCambio({ recibido: e.target.value })}
          className="cifras"
        />
      </Campo>
      <div className="flex flex-wrap gap-1.5">
        {[cubre, ...billetes(cubre)].map((v, i) => (
          <Button
            key={v}
            type="button"
            size="sm"
            variant="outline"
            className="px-2 text-xs md:h-7"
            onClick={() => onCambio({ recibido: String(v) })}
          >
            {i === 0 ? "Exacto" : pesos(v)}
          </Button>
        ))}
      </div>
      {vuelto !== null ? (
        <p
          className={cn(
            "cifras text-sm font-semibold",
            vuelto < 0 ? "text-ac-error" : "text-ac-exito",
          )}
          aria-live="polite"
        >
          {vuelto < 0 ? `Faltan ${pesos(-vuelto)}` : `Vuelto: ${pesos(vuelto)}`}
        </p>
      ) : null}
    </div>
  );
}

/** Métodos en cuadrícula de 3 (en el celular también, como la app). */
export function Tarjetas({
  metodos,
  elegido,
  onElegir,
}: {
  metodos: MetodoVenta[];
  elegido: string;
  onElegir: (id: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Método de pago"
      className="grid grid-cols-3 gap-2"
    >
      {metodos.map((m) => {
        const Icono = ICONO_METODO[m.tipo];
        const activo = elegido === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onElegir(m.id)}
            className={cn(
              "flex min-h-[72px] flex-col items-start justify-between gap-2 rounded-lg border p-3 text-left text-sm font-medium transition-colors",
              activo
                ? "border-ac-laguna bg-ac-laguna-claro text-ac-laguna-hondo"
                : "border-ac-borde bg-ac-papel hover:bg-ac-niebla",
            )}
          >
            <Icono className="h-5 w-5" aria-hidden="true" />
            {m.nombre}
          </button>
        );
      })}
    </div>
  );
}

export function FilaVarios({
  fila,
  metodos,
  quitar,
  onCambio,
  onQuitar,
}: {
  fila: Fila;
  metodos: MetodoVenta[];
  quitar: boolean;
  onCambio: (f: Partial<Fila>) => void;
  onQuitar: () => void;
}) {
  const tipo = metodos.find((m) => m.id === fila.metodoId)?.tipo;
  const efectivo = tipo === "efectivo";
  return (
    <li className="grid grid-cols-[1fr_120px_auto] items-end gap-2 border-b border-ac-borde pb-3">
      <select
        aria-label="Método"
        className={SELECTOR}
        value={fila.metodoId}
        onChange={(e) => onCambio({ metodoId: e.target.value })}
      >
        <option value="">Elige el método…</option>
        {metodos.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nombre}
          </option>
        ))}
      </select>
      <Input
        aria-label="Monto"
        inputMode="numeric"
        value={fila.monto}
        onChange={(e) => onCambio({ monto: e.target.value })}
        className="cifras"
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label="Quitar método"
        disabled={!quitar}
        onClick={onQuitar}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      {efectivo ? (
        <label className="col-span-2 flex items-center gap-2 text-xs text-ac-pizarra">
          <span className="shrink-0">Recibido</span>
          <Input
            aria-label="Efectivo recibido"
            inputMode="numeric"
            placeholder="Para calcular el vuelto"
            value={fila.recibido}
            onChange={(e) => onCambio({ recibido: e.target.value })}
            className="cifras"
          />
        </label>
      ) : null}
      {tipo === "gift_card" ? (
        <label className="col-span-2 flex items-center gap-2 text-xs text-ac-pizarra">
          <span className="shrink-0">Código</span>
          <Input
            aria-label="Código de la gift card"
            placeholder="ABCD-EFGH"
            maxLength={9}
            value={fila.comprobante}
            onChange={(e) => onCambio({ comprobante: e.target.value })}
            className="uppercase"
          />
        </label>
      ) : null}
    </li>
  );
}

const PORCENTAJES = [0, 5, 10, 15] as const;

/** Lo elegido en la propina: un porcentaje de lo que se paga, u otro monto escrito. */
export interface ValorPropina {
  opcion: (typeof PORCENTAJES)[number] | "otro";
  otro: string;
}

export const SIN_PROPINA: ValorPropina = { opcion: 0, otro: "" };

/** La propina en pesos (el porcentaje se redondea a la centena). */
export function propinaEnPesos(v: ValorPropina, base: number): number {
  if (v.opcion === "otro") return leerPesos(v.otro) ?? 0;
  return Math.round((base * v.opcion) / 100 / 100) * 100;
}

/** Propina para el profesional (0019): sin propina, 5, 10 o 15 % de lo que se paga, u otro monto. */
export function Propina({
  valor,
  base,
  onCambio,
}: {
  valor: ValorPropina;
  /** Lo que se paga ahora (la propina en % sale de aquí). */
  base: number;
  onCambio: (v: ValorPropina) => void;
}) {
  const pesosPropina = propinaEnPesos(valor, base);
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Propina</legend>
      <div
        role="radiogroup"
        aria-label="Propina"
        className="flex flex-wrap gap-1.5"
      >
        {[...PORCENTAJES, "otro" as const].map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={valor.opcion === o}
            onClick={() => onCambio({ ...valor, opcion: o })}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border px-3 text-sm font-medium md:min-h-8",
              valor.opcion === o
                ? "border-ac-laguna bg-ac-laguna-claro text-ac-laguna-hondo"
                : "border-ac-borde bg-ac-papel hover:bg-ac-niebla",
            )}
          >
            {o === 0 ? "Sin propina" : o === "otro" ? "Otro monto" : `${o} %`}
          </button>
        ))}
      </div>
      {valor.opcion === "otro" ? (
        <Input
          aria-label="Monto de la propina"
          inputMode="numeric"
          value={valor.otro}
          placeholder="$0"
          onChange={(e) => onCambio({ ...valor, otro: e.target.value })}
          className="cifras max-w-[200px]"
        />
      ) : null}
      {pesosPropina > 0 ? (
        <p className="cifras text-sm text-ac-pizarra">
          {pesos(pesosPropina)} para el profesional, aparte del total
        </p>
      ) : null}
    </fieldset>
  );
}
