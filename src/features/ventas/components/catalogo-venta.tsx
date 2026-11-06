"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Search, UserPlus, X } from "lucide-react";
import { buscarClientes } from "@/features/clientes/actions";
import { ModalCliente } from "@/features/clientes/components/modal-cliente";
import {
  CLIENTE_VACIO,
  type ClienteResumen,
} from "@/features/clientes/schemas";
import { Campo } from "@/shared/components/campo";
import { telefono } from "@/shared/lib/formato";
import { cn, iniciales } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { leerPesos } from "../lib/venta";
import type { DatosPanel, ProductoVenta, ServicioVenta } from "../types";
import { PestanaItems, type ExtraVenta } from "./pestana-items";

export type PestanaCatalogo = "items" | "clientes" | "opciones";
export interface Descuento {
  modo: "pesos" | "porcentaje";
  valor: number;
}

const PESTANAS: { id: PestanaCatalogo; nombre: string }[] = [
  { id: "items", nombre: "Ítems" },
  { id: "clientes", nombre: "Clientes" },
  { id: "opciones", nombre: "Más opciones" },
];

function PestanaClientes({
  cliente,
  obligatorio,
  onCliente,
}: {
  cliente: ClienteResumen | null;
  obligatorio: boolean;
  onCliente: (c: ClienteResumen | null) => void;
}) {
  const [texto, setTexto] = useState("");
  const [consulta, setConsulta] = useState("");
  const [nuevo, setNuevo] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setConsulta(texto.trim()), 250);
    return () => window.clearTimeout(t);
  }, [texto]);
  const resultados = useQuery({
    queryKey: ["venta-clientes", consulta],
    queryFn: () => buscarClientes(consulta),
    enabled: consulta.length >= 2,
  });
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex gap-2">
        <label className="relative block flex-1">
          <span className="sr-only">Buscar cliente</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ac-neblina"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Nombre, documento, correo o teléfono"
            className="pl-9"
          />
        </label>
        <Button variant="outline" onClick={() => setNuevo(true)}>
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Nuevo</span>
        </Button>
      </div>
      {cliente && !obligatorio ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => onCliente(null)}
        >
          <X className="h-4 w-4" aria-hidden="true" /> Vender sin cliente
        </Button>
      ) : null}
      <ul
        className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1"
        aria-label="Clientes encontrados"
        aria-busy={resultados.isFetching}
      >
        {consulta.length < 2 ? (
          <li className="py-8 text-center text-sm text-ac-pizarra">
            Escribe al menos 2 letras para buscar.
          </li>
        ) : resultados.isFetching && !resultados.data ? (
          <li className="flex justify-center py-8">
            <Loader2
              className="h-5 w-5 animate-spin text-ac-pizarra"
              aria-label="Buscando"
            />
          </li>
        ) : resultados.data?.length ? (
          resultados.data.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onCliente(c)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-ac-niebla",
                  cliente?.id === c.id && "bg-ac-laguna-claro",
                )}
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ac-laguna-claro text-xs font-bold text-ac-laguna-hondo">
                  {iniciales(c.nombre, c.apellido)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {c.nombre} {c.apellido}
                  </span>
                  <span className="block truncate text-xs text-ac-pizarra">
                    {[c.correo, telefono(c.telefono), c.documento]
                      .filter(Boolean)
                      .join(" · ") || "Sin contacto"}
                  </span>
                </span>
              </button>
            </li>
          ))
        ) : (
          <li className="py-8 text-center text-sm text-ac-pizarra">
            Nadie coincide con «{consulta}».
          </li>
        )}
      </ul>
      {nuevo ? (
        <ModalCliente
          inicial={CLIENTE_VACIO}
          onCerrar={() => setNuevo(false)}
          onGuardado={(c) => onCliente(c)}
        />
      ) : null}
    </div>
  );
}

function PestanaOpciones({
  descuento,
  onDescuento,
  onItemLibre,
}: {
  descuento: Descuento;
  onDescuento: (d: Descuento) => void;
  onItemLibre: (descripcion: string, precio: number) => void;
}) {
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const precioLibre = leerPesos(precio);
  return (
    <div className="space-y-5 overflow-y-auto">
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Descuento a la venta</legend>
        <div className="flex gap-2">
          <div
            className="inline-flex rounded-md border border-ac-borde p-0.5"
            role="radiogroup"
            aria-label="Tipo de descuento"
          >
            {(["pesos", "porcentaje"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={descuento.modo === m}
                onClick={() => onDescuento({ modo: m, valor: 0 })}
                className={cn(
                  "h-11 w-11 rounded text-sm font-semibold md:h-8 md:w-10",
                  descuento.modo === m
                    ? "bg-ac-laguna text-ac-papel"
                    : "text-ac-pizarra hover:bg-ac-niebla",
                )}
              >
                {m === "pesos" ? "$" : "%"}
              </button>
            ))}
          </div>
          <Input
            aria-label={
              descuento.modo === "pesos"
                ? "Descuento en pesos"
                : "Descuento en porcentaje"
            }
            inputMode="numeric"
            value={descuento.valor ? String(descuento.valor) : ""}
            placeholder={descuento.modo === "pesos" ? "0" : "0 %"}
            onChange={(e) =>
              onDescuento({
                ...descuento,
                valor: leerPesos(e.target.value) ?? 0,
              })
            }
            className="cifras max-w-[160px]"
          />
        </div>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Ítem libre</legend>
        <p className="text-xs text-ac-pizarra">
          Para cobrar algo que no está en el catálogo (un extra, un recargo).
        </p>
        <Campo id="venta-libre" etiqueta="Descripción">
          <Input
            id="venta-libre"
            value={descripcion}
            maxLength={120}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </Campo>
        <Campo id="venta-libre-precio" etiqueta="Precio">
          <Input
            id="venta-libre-precio"
            inputMode="numeric"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            className="cifras"
          />
        </Campo>
        <Button
          variant="outline"
          disabled={!descripcion.trim() || precioLibre === null}
          onClick={() => {
            onItemLibre(descripcion.trim(), precioLibre ?? 0);
            setDescripcion("");
            setPrecio("");
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Agregar ítem
        </Button>
      </fieldset>
    </div>
  );
}

/** Columna "armar la venta": pestañas Ítems · Clientes · Más opciones (flujos.md §5). */
export function CatalogoVenta(p: {
  datos: DatosPanel;
  pestana: PestanaCatalogo;
  onPestana: (t: PestanaCatalogo) => void;
  onAgregar: (s: ServicioVenta) => void;
  onAgregarProducto: (p: ProductoVenta) => void;
  onAgregarExtra: (e: ExtraVenta) => void;
  onItemLibre: (descripcion: string, precio: number) => void;
  cliente: ClienteResumen | null;
  onCliente: (c: ClienteResumen | null) => void;
  descuento: Descuento;
  onDescuento: (d: Descuento) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div
        role="tablist"
        aria-label="Armar la venta"
        className="flex gap-1 border-b border-ac-borde"
      >
        {PESTANAS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={p.pestana === t.id}
            onClick={() => p.onPestana(t.id)}
            className={cn(
              "-mb-px border-b-2 px-3 py-3 text-sm font-medium md:py-2",
              p.pestana === t.id
                ? "border-ac-laguna text-ac-laguna-hondo"
                : "border-transparent text-ac-pizarra hover:text-ac-tinta",
            )}
          >
            {t.nombre}
          </button>
        ))}
      </div>
      {p.pestana === "items" ? (
        <PestanaItems
          datos={p.datos}
          onAgregar={p.onAgregar}
          onAgregarProducto={p.onAgregarProducto}
          onAgregarExtra={p.onAgregarExtra}
        />
      ) : null}
      {p.pestana === "clientes" ? (
        <PestanaClientes
          cliente={p.cliente}
          obligatorio={p.datos.clienteObligatorio}
          onCliente={p.onCliente}
        />
      ) : null}
      {p.pestana === "opciones" ? (
        <PestanaOpciones
          descuento={p.descuento}
          onDescuento={p.onDescuento}
          onItemLibre={p.onItemLibre}
        />
      ) : null}
    </div>
  );
}
