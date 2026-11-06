"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Campo } from "@/shared/components/campo";
import { pesos } from "@/shared/lib/formato";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { rectificarCaja, registrarMovimiento } from "../actions";
import { leerPesos } from "../lib/venta";

export type TipoVentana =
  | { tipo: "ingreso"; efectivo: boolean }
  | { tipo: "egreso" }
  | { tipo: "traspaso" }
  | { tipo: "rectificar" };

const TEXTOS: Record<
  TipoVentana["tipo"],
  { titulo: string; ayuda: string; concepto: string; listo: string }
> = {
  ingreso: {
    listo: "Ingreso registrado",
    titulo: "Registrar ingreso",
    ayuda:
      "Dinero que entra a la caja y no viene de una venta (por ejemplo, la base del día).",
    concepto: "Base de caja",
  },
  egreso: {
    listo: "Egreso registrado",
    titulo: "Registrar egreso",
    ayuda:
      "Dinero que sale de la caja: compras de insumos, domicilios, adelantos.",
    concepto: "Compra de insumos",
  },
  traspaso: {
    listo: "Traspaso registrado",
    titulo: "Registrar traspaso",
    ayuda: "Efectivo que sale de la caja hacia el banco o la caja fuerte.",
    concepto: "Consignación al banco",
  },
  rectificar: {
    listo: "Caja rectificada",
    titulo: "Rectificar efectivo",
    ayuda:
      "Cuenta el efectivo de la caja: la diferencia queda registrada con su signo.",
    concepto: "",
  },
};

/** Ventana de Ingreso · Egreso · Traspaso · Rectificar efectivo de la caja (US-043). */
export function VentanaMovimiento({
  ventana,
  localId,
  efectivoEnCaja,
  onCerrar,
}: {
  ventana: TipoVentana;
  localId: string;
  efectivoEnCaja: number;
  onCerrar: () => void;
}) {
  const textos = TEXTOS[ventana.tipo];
  const [monto, setMonto] = useState("");
  const [concepto, setConcepto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransicionRed();
  const valor = leerPesos(monto);
  const diferencia =
    ventana.tipo === "rectificar" && valor !== null
      ? valor - efectivoEnCaja
      : null;

  function guardar() {
    setError(null);
    iniciar(async () => {
      if (ventana.tipo === "rectificar") {
        const r = await rectificarCaja({ localId, contado: valor ?? -1 });
        if (!r.ok) return setError(r.error);
        const d = r.datos.diferencia;
        toast.success(
          d === 0
            ? "Caja cuadrada: sin diferencia"
            : d > 0
              ? `Sobrante de ${pesos(d)} registrado`
              : `Faltante de ${pesos(-d)} registrado`,
        );
        return onCerrar();
      }
      const r = await registrarMovimiento({
        localId,
        tipo: ventana.tipo,
        monto: valor ?? 0,
        concepto: concepto.trim() || textos.concepto,
        efectivo: ventana.tipo === "ingreso" ? ventana.efectivo : true,
      });
      if (!r.ok) return setError(r.error);
      toast.success(textos.listo);
      onCerrar();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !guardando && onCerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {textos.titulo}
            {ventana.tipo === "ingreso" && !ventana.efectivo
              ? " (otro medio)"
              : ""}
          </DialogTitle>
          <DialogDescription>{textos.ayuda}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          <Campo
            id="movimiento-monto"
            etiqueta={
              ventana.tipo === "rectificar" ? "Efectivo contado" : "Monto"
            }
            obligatorio
            error={error ?? undefined}
          >
            <Input
              id="movimiento-monto"
              inputMode="numeric"
              autoFocus
              value={monto}
              onChange={(e) => {
                setMonto(e.target.value);
                setError(null);
              }}
              className="cifras"
            />
          </Campo>
          {ventana.tipo === "rectificar" ? (
            <div className="cifras space-y-1 rounded-md bg-ac-niebla px-3 py-2 text-sm">
              <p className="flex justify-between">
                <span className="text-ac-pizarra">Efectivo esperado</span>
                <span>{pesos(efectivoEnCaja)}</span>
              </p>
              {diferencia !== null ? (
                <p
                  className="flex justify-between font-semibold"
                  aria-live="polite"
                >
                  <span>
                    {diferencia === 0
                      ? "Sin diferencia"
                      : diferencia > 0
                        ? "Sobrante"
                        : "Faltante"}
                  </span>
                  <span
                    className={
                      diferencia < 0
                        ? "text-ac-error"
                        : diferencia > 0
                          ? "text-ac-exito"
                          : ""
                    }
                  >
                    {diferencia > 0 ? "+" : diferencia < 0 ? "−" : ""}
                    {pesos(Math.abs(diferencia))}
                  </span>
                </p>
              ) : null}
            </div>
          ) : (
            <Campo
              id="movimiento-concepto"
              etiqueta="Concepto"
              ayuda={`Si lo dejas vacío: «${textos.concepto}»`}
            >
              <Input
                id="movimiento-concepto"
                value={concepto}
                maxLength={120}
                placeholder={textos.concepto}
                onChange={(e) => setConcepto(e.target.value)}
              />
            </Campo>
          )}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCerrar}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando || valor === null}>
              {guardando ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {ventana.tipo === "rectificar" ? "Rectificar" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
