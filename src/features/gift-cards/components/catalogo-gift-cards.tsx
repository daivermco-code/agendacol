"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { Gift, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { leerPesos } from "@/features/ventas/lib/venta";
import { Campo } from "@/shared/components/campo";
import { Vacio } from "@/shared/components/vacio";
import { pesos } from "@/shared/lib/formato";
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
import { Switch } from "@/shared/ui/switch";
import { guardarModeloGiftCard } from "../actions";
import { COLORES_GIFT_CARD, FONDO_GIFT_CARD } from "../lib/gift-cards";
import type { ColorGiftCard, ModeloGiftCard } from "../types";

/** La tarjeta como se vería impresa: color del diseño, nombre y saldo. */
export function TarjetaRegalo({
  nombre,
  monto,
  color,
  className,
}: {
  nombre: string;
  monto: number;
  color: ColorGiftCard;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex aspect-[1.6] flex-col justify-between rounded-xl p-4 text-white shadow-quieta",
        className,
      )}
      style={{ backgroundColor: FONDO_GIFT_CARD[color] }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold">{nombre}</span>
        <Gift className="h-5 w-5 shrink-0 opacity-90" aria-hidden="true" />
      </div>
      <p className="cifras text-2xl font-bold tracking-tight">{pesos(monto)}</p>
    </div>
  );
}

const numero = (t: string) => {
  const n = Number(t.replace(/\D/g, ""));
  return t.trim() === "" || Number.isNaN(n) ? -1 : n;
};

function ModalGiftCard({
  modelo,
  onCerrar,
}: {
  modelo: ModeloGiftCard | null;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(modelo?.nombre ?? "");
  const [monto, setMonto] = useState(modelo ? String(modelo.monto) : "");
  const [precio, setPrecio] = useState(modelo ? String(modelo.precio) : "");
  const [vigencia, setVigencia] = useState(String(modelo?.vigenciaDias ?? 365));
  const [color, setColor] = useState<ColorGiftCard>(modelo?.color ?? "laguna");
  const [activo, setActivo] = useState(modelo?.activo ?? true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransicionRed();
  const montoNum = leerPesos(monto) ?? 0;

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await guardarModeloGiftCard({
        id: modelo?.id ?? null,
        nombre,
        monto: leerPesos(monto) ?? -1,
        precio: precio.trim()
          ? (leerPesos(precio) ?? -1)
          : (leerPesos(monto) ?? -1),
        vigenciaDias: numero(vigencia),
        color,
        activo,
      });
      if (!r.ok) return setError(r.error);
      toast.success(modelo ? "Gift card guardada" : "Gift card creada");
      onCerrar();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !guardando && onCerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {modelo ? "Editar gift card" : "Nueva gift card"}
          </DialogTitle>
          <DialogDescription>
            Se vende en la caja; quien la recibe paga con su código hasta gastar
            el saldo.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          <TarjetaRegalo
            nombre={nombre || "Gift card"}
            monto={montoNum}
            color={color}
            className="mx-auto w-60"
          />
          <Campo id="gift-nombre" etiqueta="Nombre" obligatorio>
            <Input
              id="gift-nombre"
              value={nombre}
              maxLength={60}
              autoFocus
              onChange={(e) => setNombre(e.target.value)}
            />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo id="gift-monto" etiqueta="Saldo que carga" obligatorio>
              <Input
                id="gift-monto"
                inputMode="numeric"
                className="cifras"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </Campo>
            <Campo
              id="gift-precio"
              etiqueta="Precio de venta"
              ayuda="Vacío = igual al saldo"
            >
              <Input
                id="gift-precio"
                inputMode="numeric"
                className="cifras"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
              />
            </Campo>
          </div>
          <Campo
            id="gift-vigencia"
            etiqueta="Vigencia (días)"
            ayuda="De 30 a 730 días desde la venta"
          >
            <Input
              id="gift-vigencia"
              inputMode="numeric"
              className="cifras max-w-[120px]"
              value={vigencia}
              onChange={(e) => setVigencia(e.target.value)}
            />
          </Campo>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Diseño</legend>
            <div className="flex gap-2" role="radiogroup" aria-label="Diseño">
              {COLORES_GIFT_CARD.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={color === c.id}
                  aria-label={c.nombre}
                  onClick={() => setColor(c.id)}
                  className={cn(
                    "h-11 w-11 rounded-full ring-offset-2 md:h-9 md:w-9",
                    color === c.id && "ring-2 ring-ac-foco",
                  )}
                  style={{ backgroundColor: FONDO_GIFT_CARD[c.id] }}
                />
              ))}
            </div>
          </fieldset>
          {modelo ? (
            <label className="flex items-center justify-between gap-3 rounded-md border border-ac-borde px-3 py-2.5 text-sm">
              <span>
                <span className="block font-medium">A la venta</span>
                <span className="text-ac-pizarra">
                  Apagada no sale en la caja.
                </span>
              </span>
              <Switch
                checked={activo}
                onCheckedChange={setActivo}
                aria-label="A la venta"
              />
            </label>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-ac-error">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onCerrar}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {modelo ? "Guardar" : "Crear gift card"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Administración → Gift cards: el catálogo que se vende en la caja. */
export function CatalogoGiftCards({ modelos }: { modelos: ModeloGiftCard[] }) {
  const [editando, setEditando] = useState<ModeloGiftCard | "nueva" | null>(
    null,
  );
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditando("nueva")}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Nueva gift card
        </Button>
      </div>
      {modelos.length === 0 ? (
        <Vacio
          icono={Gift}
          titulo="Aún no tienes gift cards"
          texto="Crea una con el saldo que carga y su precio; luego se vende en la caja."
        />
      ) : (
        <ul
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          aria-label="Gift cards"
        >
          {modelos.map((m) => (
            <li
              key={m.id}
              className={cn(
                "space-y-3 rounded-lg border border-ac-borde bg-ac-papel p-3 shadow-quieta",
                !m.activo && "opacity-70",
              )}
            >
              <TarjetaRegalo
                nombre={m.nombre}
                monto={m.monto}
                color={m.color}
              />
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-semibold">{m.nombre}</p>
                  <p className="cifras text-ac-pizarra">
                    Precio {pesos(m.precio)} · vale {m.vigenciaDias} días
                  </p>
                  <p className="cifras text-xs text-ac-pizarra">
                    {m.activo ? "A la venta" : "No está a la venta"} ·{" "}
                    {m.vendidas} {m.vendidas === 1 ? "vendida" : "vendidas"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditando(m)}
                  aria-label={`Editar ${m.nombre}`}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" /> Editar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editando ? (
        <ModalGiftCard
          modelo={editando === "nueva" ? null : editando}
          onCerrar={() => setEditando(null)}
        />
      ) : null}
    </div>
  );
}
