"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { duracion, pesos } from "@/shared/lib/formato";
import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/input";
import type {
  DatosPanel,
  GiftCardVenta,
  PlanVenta,
  ProductoVenta,
  ServicioVenta,
} from "../types";

type Atajo = "recientes" | "servicios" | "productos" | "gift_cards" | "planes";
type Fila =
  | { tipo: "servicio"; s: ServicioVenta }
  | { tipo: "producto"; p: ProductoVenta }
  | { tipo: "gift_card"; g: GiftCardVenta }
  | { tipo: "plan"; p: PlanVenta };

/** Gift card o plan que se agrega a la venta (cada uno es un ítem de cantidad 1). */
export interface ExtraVenta {
  planId?: string;
  giftCardModeloId?: string;
  descripcion: string;
  precio: number;
}

const sinTildes = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

function BotonAtajo({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full border px-3 py-1 text-sm md:min-h-0",
        activo
          ? "border-ac-laguna bg-ac-laguna-claro font-medium text-ac-laguna-hondo"
          : "border-ac-borde bg-ac-papel text-ac-pizarra hover:bg-ac-niebla",
      )}
    >
      {children}
    </button>
  );
}

function detalleServicio(s: ServicioVenta) {
  if (s.tipo === "sesiones")
    return `${s.sesiones} sesiones · queda a nombre del cliente`;
  if (s.tipo === "paquete")
    return `Paquete de ${s.sesiones} servicios · queda a nombre del cliente`;
  return `${duracion(s.duracionMin)}${s.categoria ? ` · ${s.categoria}` : ""}`;
}

function detalle(f: Fila) {
  if (f.tipo === "servicio") return detalleServicio(f.s);
  if (f.tipo === "gift_card")
    return f.g.precio === f.g.monto
      ? `Gift card · carga ${pesos(f.g.monto)}`
      : `Gift card · carga ${pesos(f.g.monto)} (paga ${pesos(f.g.precio)})`;
  if (f.tipo === "plan")
    return `Plan · ${f.p.sesiones ? `${f.p.sesiones} citas` : "citas sin límite"} en ${f.p.vigenciaDias} días`;
  const { existencias } = f.p;
  if (existencias === 0) return "Producto · Agotado";
  return `Producto · ${existencias} ${existencias === 1 ? "disponible" : "disponibles"}`;
}

const nombreDe = (f: Fila) =>
  f.tipo === "servicio"
    ? f.s.nombre
    : f.tipo === "gift_card"
      ? f.g.nombre
      : f.p.nombre;
const precioDe = (f: Fila) =>
  f.tipo === "servicio"
    ? f.s.precio
    : f.tipo === "gift_card"
      ? f.g.precio
      : f.p.precio;
const claveDe = (f: Fila) =>
  `${f.tipo}-${f.tipo === "servicio" ? f.s.id : f.tipo === "gift_card" ? f.g.id : f.p.id}`;

function filas(datos: DatosPanel, atajo: Atajo, buscado: string): Fila[] {
  const servicios = datos.servicios.map((s): Fila => ({ tipo: "servicio", s }));
  const productos = datos.productos.map((p): Fila => ({ tipo: "producto", p }));
  const giftCards = datos.giftCards.map((g): Fila => ({
    tipo: "gift_card",
    g,
  }));
  const planes = datos.planes.map((p): Fila => ({ tipo: "plan", p }));
  if (buscado)
    return [...servicios, ...productos, ...giftCards, ...planes].filter((f) => {
      const extra =
        f.tipo === "servicio"
          ? f.s.categoria
          : f.tipo === "producto"
            ? f.p.categoria
            : f.tipo;
      return sinTildes(`${nombreDe(f)} ${extra ?? ""}`).includes(buscado);
    });
  if (atajo === "productos") return productos;
  if (atajo === "servicios") return servicios;
  if (atajo === "gift_cards") return giftCards;
  if (atajo === "planes") return planes;
  const porId = new Map(datos.servicios.map((s) => [s.id, s]));
  return datos.recientes.flatMap((id) => {
    const s = porId.get(id);
    return s ? [{ tipo: "servicio" as const, s }] : [];
  });
}

/**
 * Pestaña "Ítems": servicios (con el atajo de los más vendidos), productos con sus existencias, gift cards y
 * planes.
 */
export function PestanaItems({
  datos,
  onAgregar,
  onAgregarProducto,
  onAgregarExtra,
}: {
  datos: DatosPanel;
  onAgregar: (s: ServicioVenta) => void;
  onAgregarProducto: (p: ProductoVenta) => void;
  onAgregarExtra: (e: ExtraVenta) => void;
}) {
  const [texto, setTexto] = useState("");
  const [atajo, setAtajo] = useState<Atajo>(
    datos.recientes.length ? "recientes" : "servicios",
  );
  const buscado = sinTildes(texto.trim());
  const lista = filas(datos, atajo, buscado);
  const atajos: { id: Atajo; nombre: string; n?: number }[] = [
    { id: "recientes", nombre: "Recientes" },
    { id: "servicios", nombre: "Servicios", n: datos.servicios.length },
    { id: "productos", nombre: "Productos", n: datos.productos.length },
    { id: "gift_cards", nombre: "Gift cards", n: datos.giftCards.length },
    { id: "planes", nombre: "Planes", n: datos.planes.length },
  ];

  function agregar(f: Fila) {
    if (f.tipo === "servicio") return onAgregar(f.s);
    if (f.tipo === "producto") return onAgregarProducto(f.p);
    if (f.tipo === "gift_card")
      return onAgregarExtra({
        giftCardModeloId: f.g.id,
        descripcion: f.g.nombre,
        precio: f.g.precio,
      });
    onAgregarExtra({
      planId: f.p.id,
      descripcion: `Plan ${f.p.nombre}`,
      precio: f.p.precio,
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <label className="relative block">
        <span className="sr-only">Buscar servicios y productos</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ac-neblina"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={
            datos.productos.length
              ? "Busca servicios y productos"
              : "Busca servicios"
          }
          className="pl-9"
        />
      </label>
      {buscado ? null : (
        <div className="flex flex-wrap gap-2">
          {atajos
            .filter((a) => a.n === undefined || a.n > 0 || a.id === "servicios")
            .map((a) => (
              <BotonAtajo
                key={a.id}
                activo={atajo === a.id}
                onClick={() => setAtajo(a.id)}
              >
                {a.nombre}
                {a.n === undefined ? null : (
                  <>
                    {" "}
                    <span className="cifras">{a.n}</span>
                  </>
                )}
              </BotonAtajo>
            ))}
        </div>
      )}
      <ul
        className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1"
        aria-label="Ítems para agregar"
      >
        {lista.length === 0 ? (
          <li className="py-8 text-center text-sm text-ac-pizarra">
            {buscado
              ? `Nada coincide con «${texto.trim()}»`
              : "Aún no hay ventas recientes."}
          </li>
        ) : (
          lista.map((f) => {
            const nombre = nombreDe(f);
            const agotado = f.tipo === "producto" && f.p.existencias === 0;
            return (
              <li
                key={claveDe(f)}
                className="border-b border-ac-borde last:border-b-0"
              >
                <button
                  type="button"
                  disabled={agotado}
                  onClick={() => agregar(f)}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-ac-niebla disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                  aria-label={
                    agotado ? `${nombre}: agotado` : `Agregar ${nombre}`
                  }
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {nombre}
                    </span>
                    <span
                      className={cn(
                        "text-xs",
                        agotado ? "text-ac-error" : "text-ac-pizarra",
                      )}
                    >
                      {detalle(f)}
                    </span>
                  </span>
                  <span className="cifras text-sm">{pesos(precioDe(f))}</span>
                  <span
                    className={cn(
                      "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                      agotado
                        ? "border-ac-borde text-ac-neblina"
                        : "border-ac-laguna text-ac-laguna",
                    )}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
