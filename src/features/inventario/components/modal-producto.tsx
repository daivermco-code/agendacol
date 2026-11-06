"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { leerPesos } from "@/features/ventas/lib/venta";
import { Campo } from "@/shared/components/campo";
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
import { guardarProducto } from "../actions";
import { PRODUCTO_VACIO, type DatosProducto } from "../schemas";
import type { Producto } from "../types";

const entero = (t: string) => {
  const n = Number(t.replace(/\D/g, ""));
  return t.trim() === "" || Number.isNaN(n) ? -1 : n;
};

/** Crear o editar un producto: nombre, categoría, precio de venta, mínimo para la alerta y, al crear, existencias. */
export function ModalProducto({
  producto,
  categorias,
  onCerrar,
}: {
  producto: Producto | null;
  categorias: string[];
  onCerrar: () => void;
}) {
  const inicial: DatosProducto = producto
    ? {
        id: producto.id,
        nombre: producto.nombre,
        categoria: producto.categoria ?? "",
        precio: producto.precio,
        stockMinimo: producto.stockMinimo,
        existenciasIniciales: 0,
        activo: producto.activo,
      }
    : PRODUCTO_VACIO;
  const [nombre, setNombre] = useState(inicial.nombre);
  const [categoria, setCategoria] = useState(inicial.categoria);
  const [precio, setPrecio] = useState(producto ? String(inicial.precio) : "");
  const [minimo, setMinimo] = useState(String(inicial.stockMinimo));
  const [existencias, setExistencias] = useState("0");
  const [activo, setActivo] = useState(inicial.activo);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransicionRed();

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await guardarProducto({
        id: inicial.id,
        nombre,
        categoria,
        precio: leerPesos(precio) ?? -1,
        stockMinimo: entero(minimo),
        existenciasIniciales: producto ? 0 : entero(existencias),
        activo,
      });
      if (!r.ok) return setError(r.error);
      toast.success(producto ? "Producto guardado" : "Producto creado");
      onCerrar();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !guardando && onCerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {producto ? "Editar producto" : "Nuevo producto"}
          </DialogTitle>
          <DialogDescription>
            {producto
              ? "Las existencias se cambian con «Mover existencias», para que quede el registro."
              : "Lo que vendes además de los servicios: champús, ceras, esmaltes…"}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          <Campo id="producto-nombre" etiqueta="Nombre" obligatorio>
            <Input
              id="producto-nombre"
              value={nombre}
              maxLength={80}
              autoFocus
              onChange={(e) => setNombre(e.target.value)}
            />
          </Campo>
          <Campo
            id="producto-categoria"
            etiqueta="Categoría"
            ayuda="Para agruparlos en la lista (opcional)"
          >
            <Input
              id="producto-categoria"
              value={categoria}
              maxLength={40}
              list="categorias-producto"
              onChange={(e) => setCategoria(e.target.value)}
            />
            <datalist id="categorias-producto">
              {categorias.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo id="producto-precio" etiqueta="Precio de venta" obligatorio>
              <Input
                id="producto-precio"
                inputMode="numeric"
                className="cifras"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
              />
            </Campo>
            <Campo
              id="producto-minimo"
              etiqueta="Stock mínimo"
              ayuda="0 = sin alerta"
            >
              <Input
                id="producto-minimo"
                inputMode="numeric"
                className="cifras"
                value={minimo}
                onChange={(e) => setMinimo(e.target.value)}
              />
            </Campo>
          </div>
          {producto ? (
            <label className="flex items-center justify-between gap-3 rounded-md border border-ac-borde px-3 py-2.5 text-sm">
              <span>
                <span className="block font-medium">A la venta</span>
                <span className="text-xs text-ac-pizarra">
                  Si lo apagas, no sale en el panel de venta.
                </span>
              </span>
              <Switch
                checked={activo}
                onCheckedChange={setActivo}
                aria-label="A la venta"
              />
            </label>
          ) : (
            <Campo
              id="producto-existencias"
              etiqueta="Existencias iniciales"
              ayuda="Unidades que tienes hoy"
            >
              <Input
                id="producto-existencias"
                inputMode="numeric"
                className="cifras"
                value={existencias}
                onChange={(e) => setExistencias(e.target.value)}
              />
            </Campo>
          )}
          {error ? (
            <p
              role="alert"
              className="rounded-md bg-ac-error/10 px-3 py-2 text-sm text-ac-error"
            >
              {error}
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
            <Button type="submit" disabled={guardando}>
              {guardando ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {producto ? "Guardar" : "Crear producto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
