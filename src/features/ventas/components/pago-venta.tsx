"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Plus } from "lucide-react";
import { Campo } from "@/shared/components/campo";
import { pesos } from "@/shared/lib/formato";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { leerPesos, revisarPagos } from "../lib/venta";
import type { PagoVenta } from "../schemas";
import type { MetodoVenta } from "../types";
import {
  aPagos,
  Efectivo,
  FilaVarios,
  Propina,
  propinaEnPesos,
  SIN_PROPINA,
  Tarjetas,
  type Fila,
  type ValorPropina,
} from "./metodos-pago";

/** Con saldo $0 (cita con plan, descuento del 100 %) no hay nada que pagar: la venta se registra sin pagos. */
function SinSaldo({
  pagando,
  errorServidor,
  onPagar,
}: {
  pagando: boolean;
  errorServidor: string | null;
  onPagar: (pagos: PagoVenta[]) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <p className="flex-1 text-sm text-ac-pizarra">
        No hay nada que cobrar: la venta queda registrada en {pesos(0)}.
      </p>
      <div className="space-y-2 border-t border-ac-borde pt-3">
        {errorServidor ? (
          <p
            role="alert"
            className="flex items-center gap-1 text-sm text-ac-error"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {errorServidor}
          </p>
        ) : null}
        <Button
          className="w-full rounded-full md:rounded-md"
          size="lg"
          disabled={pagando}
          onClick={() => onPagar([])}
        >
          {pagando ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : null}
          Registrar venta
        </Button>
      </div>
    </div>
  );
}

/**
 * Método de pago: tarjetas, efectivo con vuelto, varios métodos, abono y propina (flujos.md §5, US-039 y US-040).
 * La propina va con un solo método y no con gift card; por ahora solo en el celular (T-12.11).
 */
export function PagoVenta(p: {
  metodos: MetodoVenta[];
  saldo: number;
  pagando: boolean;
  errorServidor: string | null;
  onPagar: (pagos: PagoVenta[]) => void;
  /** Muestra la propina (el celular). */
  propina?: boolean;
}) {
  return p.saldo === 0 ? <SinSaldo {...p} /> : <ConSaldo {...p} />;
}

function ConSaldo({
  metodos,
  saldo,
  pagando,
  errorServidor,
  onPagar,
  propina: mostrarPropina = false,
}: Parameters<typeof PagoVenta>[0]) {
  const [varios, setVarios] = useState(false);
  const [abono, setAbono] = useState(false);
  const [filas, setFilas] = useState<Fila[]>([
    {
      clave: 1,
      metodoId: "",
      monto: String(saldo),
      recibido: "",
      comprobante: "",
    },
  ]);
  const [propina, setPropina] = useState<ValorPropina>(SIN_PROPINA);
  const [error, setError] = useState<string | null>(null);
  // El descuento se puede cambiar desde el cobro: se ajustan los montos y se conserva lo demás (método,
  // propina, lo recibido, abono y "Varios métodos").
  const [saldoPrevio, setSaldoPrevio] = useState(saldo);
  if (saldo !== saldoPrevio) {
    setSaldoPrevio(saldo);
    setError(null);
    setFilas((fs) =>
      varios
        ? fs.map((f, i) =>
            i === fs.length - 1
              ? {
                  ...f,
                  monto: String(
                    Math.max(
                      saldo -
                        fs
                          .slice(0, -1)
                          .reduce((s, x) => s + (leerPesos(x.monto) ?? 0), 0),
                      0,
                    ),
                  ),
                }
              : f,
          )
        : abono
          ? fs
          : [{ ...fs[0], monto: String(saldo) }],
    );
  }
  const cambiar = (clave: number, cambio: Partial<Fila>) => {
    setFilas((fs) =>
      fs.map((f) => (f.clave === clave ? { ...f, ...cambio } : f)),
    );
    setError(null);
  };
  const primera = filas[0];
  const montoUnico = leerPesos(primera.monto) ?? 0;
  const tipoUnico = metodos.find((m) => m.id === primera.metodoId)?.tipo;
  const conPropina = mostrarPropina && !varios && tipoUnico !== "gift_card";
  const propinaPesos = conPropina ? propinaEnPesos(propina, montoUnico) : 0;
  const { lineas, pagos, sinMetodo, sinCodigo } = aPagos(
    varios ? filas : [primera],
    metodos,
    propinaPesos,
  );
  const suma = lineas.reduce((s, l) => s + l.monto, 0);
  const falta = saldo - suma;
  // En el celular, sin método elegido el botón ya dice cuánto se va a pagar (no "$0").
  const aPagar =
    mostrarPropina && !varios && !primera.metodoId
      ? montoUnico
      : Math.max(suma, 0);

  function pagar() {
    if (sinMetodo || pagos.length === 0)
      return setError("Elige cómo paga el cliente");
    if (sinCodigo) return setError("Escribe el código de la gift card");
    const r = revisarPagos(saldo, lineas, abono);
    if (!r.ok) return setError(r.error);
    onPagar(pagos);
  }

  function alternarVarios(v: boolean) {
    setVarios(v);
    setError(null);
    setFilas(
      v
        ? [
            { ...primera, monto: String(Math.min(montoUnico, saldo)) },
            {
              clave: primera.clave + 1,
              metodoId: "",
              monto: String(Math.max(saldo - montoUnico, 0)),
              recibido: "",
              comprobante: "",
            },
          ]
        : [{ ...primera, monto: abono ? primera.monto : String(saldo) }],
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={varios}
              onCheckedChange={alternarVarios}
              aria-label="Varios métodos de pago"
            />
            Varios métodos
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={abono}
              onCheckedChange={(v) => {
                setAbono(v);
                setError(null);
                if (!v && !varios)
                  cambiar(primera.clave, { monto: String(saldo) });
              }}
              aria-label="Abono (pago parcial)"
            />
            Abono (pago parcial)
          </label>
        </div>
        {varios ? (
          <div className="space-y-3">
            <ul className="space-y-3">
              {filas.map((f) => (
                <FilaVarios
                  key={f.clave}
                  fila={f}
                  metodos={metodos}
                  quitar={filas.length > 2}
                  onCambio={(c) => cambiar(f.clave, c)}
                  onQuitar={() =>
                    setFilas((fs) => fs.filter((x) => x.clave !== f.clave))
                  }
                />
              ))}
            </ul>
            {filas.length < 5 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setFilas((fs) => [
                    ...fs,
                    {
                      clave: Math.max(...fs.map((x) => x.clave)) + 1,
                      metodoId: "",
                      monto: String(Math.max(falta, 0)),
                      recibido: "",
                      comprobante: "",
                    },
                  ])
                }
              >
                <Plus className="h-4 w-4" aria-hidden="true" /> Agregar método
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <Tarjetas
              metodos={metodos}
              elegido={primera.metodoId}
              onElegir={(id) => cambiar(primera.clave, { metodoId: id })}
            />
            {abono ? (
              <Campo
                id="venta-abono"
                etiqueta="Monto del abono"
                ayuda={`El saldo queda en Mis cobros. Total: ${pesos(saldo)}`}
              >
                <Input
                  id="venta-abono"
                  inputMode="numeric"
                  value={primera.monto}
                  onChange={(e) =>
                    cambiar(primera.clave, { monto: e.target.value })
                  }
                  className="cifras max-w-[200px]"
                />
              </Campo>
            ) : null}
            {tipoUnico === "efectivo" ? (
              <Efectivo
                fila={primera}
                monto={montoUnico}
                propina={propinaPesos}
                onCambio={(c) => cambiar(primera.clave, c)}
              />
            ) : tipoUnico === "gift_card" ? (
              <Campo
                id="venta-gift-card"
                etiqueta="Código de la gift card"
                ayuda="8 letras y números, como ABCD-EFGH. Se descuenta de su saldo."
              >
                <Input
                  id="venta-gift-card"
                  value={primera.comprobante}
                  maxLength={9}
                  placeholder="ABCD-EFGH"
                  onChange={(e) =>
                    cambiar(primera.clave, { comprobante: e.target.value })
                  }
                  className="max-w-[240px] uppercase"
                />
              </Campo>
            ) : tipoUnico ? (
              <Campo
                id="venta-comprobante"
                etiqueta="Número de comprobante (opcional)"
                ayuda="El del datáfono o de la transferencia."
              >
                <Input
                  id="venta-comprobante"
                  value={primera.comprobante}
                  maxLength={40}
                  onChange={(e) =>
                    cambiar(primera.clave, { comprobante: e.target.value })
                  }
                  className="max-w-[240px]"
                />
              </Campo>
            ) : null}
            {conPropina ? (
              <Propina
                valor={propina}
                base={montoUnico}
                onCambio={(v) => {
                  setPropina(v);
                  setError(null);
                }}
              />
            ) : null}
          </>
        )}
      </div>
      <div className="space-y-2 border-t border-ac-borde pt-3">
        {varios || abono ? (
          <p className="cifras flex justify-between text-sm" aria-live="polite">
            <span className="text-ac-pizarra">
              {falta > 0
                ? abono
                  ? "Queda de saldo"
                  : "Falta"
                : falta < 0
                  ? "Sobra"
                  : "Completo"}
            </span>
            <span
              className={cn(
                "font-semibold",
                falta < 0 && "text-ac-error",
                falta === 0 && "text-ac-exito",
              )}
            >
              {pesos(Math.abs(falta))}
            </span>
          </p>
        ) : null}
        {error || errorServidor ? (
          <p
            role="alert"
            className="flex items-center gap-1 text-sm text-ac-error"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {error ?? errorServidor}
          </p>
        ) : null}
        <Button
          className="w-full rounded-full md:rounded-md"
          size="lg"
          disabled={pagando}
          onClick={pagar}
        >
          {pagando ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : null}
          Pagar {pesos(aPagar + propinaPesos)}
          {propinaPesos > 0 ? " con propina" : ""}
        </Button>
      </div>
    </div>
  );
}
