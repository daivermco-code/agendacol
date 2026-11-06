"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Campo } from "@/shared/components/campo";
import { cn } from "@/shared/lib/utils";
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
import { moverExistencias } from "../actions";
import type { Producto } from "../types";

const TIPOS = [
  {
    id: "entrada",
    nombre: "Entrada de mercancía",
    ayuda: "Llegó un pedido: se suma a lo que hay.",
  },
  {
    id: "conteo",
    nombre: "Conteo físico",
    ayuda: "Contaste lo que hay: las existencias quedan en lo contado.",
  },
] as const;
type Tipo = (typeof TIPOS)[number]["id"];

/** Entrada de mercancía o conteo físico de un producto; cada cambio queda en su historial. */
export function VentanaExistencias({
  producto,
  onCerrar,
}: {
  producto: Producto;
  onCerrar: () => void;
}) {
  const [tipo, setTipo] = useState<Tipo>("entrada");
  const [cantidad, setCantidad] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransicionRed();
  const n = cantidad.trim() === "" ? null : Number(cantidad.replace(/\D/g, ""));
  const quedan =
    n === null ? null : tipo === "entrada" ? producto.existencias + n : n;

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await moverExistencias({
        productoId: producto.id,
        tipo,
        cantidad: n ?? -1,
        nota,
      });
      if (!r.ok) return setError(r.error);
      const c = r.datos.cambio;
      toast.success(
        c === 0
          ? "Existencias sin cambios"
          : `${c > 0 ? "+" : "−"}${Math.abs(c)} ${Math.abs(c) === 1 ? "unidad" : "unidades"}: quedan ${r.datos.existencias}`,
      );
      onCerrar();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !guardando && onCerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mover existencias</DialogTitle>
          <DialogDescription>
            {producto.nombre} · hay{" "}
            <span className="cifras font-semibold">{producto.existencias}</span>
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          <div
            role="radiogroup"
            aria-label="Qué vas a registrar"
            className="grid gap-2 sm:grid-cols-2"
          >
            {TIPOS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={tipo === t.id}
                onClick={() => setTipo(t.id)}
                className={cn(
                  "rounded-md border px-3 py-2.5 text-left text-sm",
                  tipo === t.id
                    ? "border-ac-laguna bg-ac-laguna-claro ring-1 ring-ac-laguna"
                    : "border-ac-borde hover:bg-ac-niebla",
                )}
              >
                <span className="block font-medium">{t.nombre}</span>
                <span className="text-xs text-ac-pizarra">{t.ayuda}</span>
              </button>
            ))}
          </div>
          <Campo
            id="existencias-cantidad"
            etiqueta={
              tipo === "entrada" ? "Unidades que entraron" : "Unidades contadas"
            }
            obligatorio
            error={error ?? undefined}
          >
            <Input
              id="existencias-cantidad"
              inputMode="numeric"
              autoFocus
              className="cifras"
              value={cantidad}
              onChange={(e) => {
                setCantidad(e.target.value);
                setError(null);
              }}
            />
          </Campo>
          <Campo
            id="existencias-nota"
            etiqueta="Nota"
            ayuda="Proveedor, factura o por qué cambió (opcional)"
          >
            <Input
              id="existencias-nota"
              value={nota}
              maxLength={120}
              onChange={(e) => setNota(e.target.value)}
            />
          </Campo>
          {quedan !== null && !Number.isNaN(quedan) ? (
            <p
              className="cifras rounded-md bg-ac-niebla px-3 py-2 text-sm"
              aria-live="polite"
            >
              Quedarán <strong>{quedan}</strong>{" "}
              {quedan !== producto.existencias
                ? `(${quedan > producto.existencias ? "+" : "−"}${Math.abs(quedan - producto.existencias)})`
                : "(sin cambios)"}
            </p>
          ) : null}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCerrar}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando || n === null}>
              {guardando ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
