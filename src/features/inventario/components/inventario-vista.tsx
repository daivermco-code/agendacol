"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import {
  AlertTriangle,
  ArrowDownUp,
  History,
  MoreVertical,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirmar } from "@/shared/components/confirmar";
import { Vacio } from "@/shared/components/vacio";
import { pesos } from "@/shared/lib/formato";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { borrarProducto } from "../actions";
import { enStockBajo, type Producto } from "../types";
import { HistorialProducto } from "./historial-producto";
import { ModalProducto } from "./modal-producto";
import { VentanaExistencias } from "./ventana-existencias";

type Ventana =
  | { tipo: "producto"; producto: Producto | null }
  | { tipo: "existencias"; producto: Producto }
  | { tipo: "historial"; producto: Producto };

function Cifra({
  titulo,
  valor,
  ayuda,
}: {
  titulo: string;
  valor: string;
  ayuda: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-ac-borde bg-ac-papel p-3 shadow-quieta sm:p-4">
      <p className="text-[13px] font-medium text-ac-pizarra">{titulo}</p>
      <p className="mt-1 truncate text-xl font-bold leading-tight tracking-tight sm:text-2xl">
        {valor}
      </p>
      <p className="mt-1 text-xs text-ac-neblina">{ayuda}</p>
    </div>
  );
}

/** Agotado o en el mínimo, con ícono y texto: el color nunca va solo. */
function EstadoExistencias({ p }: { p: Producto }) {
  if (p.existencias === 0)
    return (
      <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-ac-error/10 px-2 py-0.5 text-xs font-medium text-ac-error">
        <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Agotado
      </span>
    );
  if (enStockBajo(p))
    return (
      <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-ac-aviso/15 px-2 py-0.5 text-xs font-medium text-ac-tinta">
        <AlertTriangle className="h-3 w-3 text-ac-aviso" aria-hidden="true" />{" "}
        Stock bajo
      </span>
    );
  return null;
}

function Acciones({
  p,
  abrir,
  borrar,
}: {
  p: Producto;
  abrir: (v: Ventana) => void;
  borrar: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 md:gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={() => abrir({ tipo: "existencias", producto: p })}
      >
        <ArrowDownUp className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Mover existencias</span>
        <span className="sr-only sm:hidden">
          Mover existencias de {p.nombre}
        </span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="area-tactil rounded-md p-1.5 hover:bg-ac-niebla"
          aria-label={`Más opciones de ${p.nombre}`}
        >
          <MoreVertical className="h-4 w-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => abrir({ tipo: "historial", producto: p })}
          >
            <History aria-hidden="true" /> Historial
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => abrir({ tipo: "producto", producto: p })}
          >
            <Pencil aria-hidden="true" /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={borrar} className="text-ac-error">
            <Trash2 aria-hidden="true" /> Borrar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function NombreProducto({ p }: { p: Producto }) {
  return (
    <span className="min-w-0">
      <span className="block truncate font-medium">
        {p.nombre}
        {!p.activo ? (
          <span className="ml-2 rounded-full bg-ac-niebla-oscura px-2 py-0.5 text-xs font-medium text-ac-pizarra">
            Inactivo
          </span>
        ) : null}
      </span>
      {p.categoria ? (
        <span className="block truncate text-xs text-ac-neblina">
          {p.categoria}
        </span>
      ) : null}
    </span>
  );
}

function Resumen({ productos }: { productos: Producto[] }) {
  const activos = productos.filter((p) => p.activo);
  const bajos = activos.filter(enStockBajo);
  const agotados = activos.filter((p) => p.existencias === 0).length;
  const unidades = activos.reduce((s, p) => s + p.existencias, 0);
  const valor = activos.reduce((s, p) => s + p.existencias * p.precio, 0);
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Cifra
        titulo="A la venta"
        valor={String(activos.length)}
        ayuda={`de ${productos.length} productos`}
      />
      <Cifra
        titulo="Unidades"
        valor={unidades.toLocaleString("es-CO")}
        ayuda="en existencia"
      />
      <Cifra
        titulo="Valor del inventario"
        valor={pesos(valor)}
        ayuda="a precio de venta"
      />
      <Cifra
        titulo="Stock bajo"
        valor={String(bajos.length)}
        ayuda={
          agotados
            ? `${agotados} ${agotados === 1 ? "agotado" : "agotados"}`
            : "ninguno agotado"
        }
      />
    </div>
  );
}

/** Inventario: productos con sus existencias, alerta de stock bajo y los movimientos de cada uno. */
export function InventarioVista({
  productos,
  soloBajoInicial,
}: {
  productos: Producto[];
  soloBajoInicial: boolean;
}) {
  const [filtro, setFiltro] = useState("");
  const [soloBajo, setSoloBajo] = useState(soloBajoInicial);
  const [ventana, setVentana] = useState<Ventana | null>(null);
  const [, iniciar] = useTransicionRed();
  const [dialogo, confirmar] = useConfirmar();
  const texto = filtro.trim().toLowerCase();
  const lista = productos.filter(
    (p) =>
      (!texto ||
        p.nombre.toLowerCase().includes(texto) ||
        (p.categoria ?? "").toLowerCase().includes(texto)) &&
      (!soloBajo || (p.activo && enStockBajo(p))),
  );
  const categorias = [
    ...new Set(
      productos.map((p) => p.categoria).filter((c): c is string => !!c),
    ),
  ].sort();
  // La ventana abierta muestra el producto como viene del servidor tras cada cambio.
  const actual = ventana?.producto
    ? (productos.find((p) => p.id === ventana.producto?.id) ?? ventana.producto)
    : null;

  async function borrar(p: Producto) {
    const ok = await confirmar({
      titulo: `¿Borrar "${p.nombre}"?`,
      texto:
        "Si ya se vendió, no se puede borrar: desactívalo para que no salga a la venta.",
      aceptar: "Borrar",
      peligro: true,
    });
    if (!ok) return;
    iniciar(async () => {
      const r = await borrarProducto(p.id);
      if (r.ok) toast.success("Producto borrado");
      else toast.error(r.error, { duration: Infinity });
    });
  }

  return (
    <>
      <Resumen productos={productos} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ac-neblina"
            aria-hidden="true"
          />
          <Input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar producto"
            className="pl-9 md:h-9"
            aria-label="Buscar producto"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={soloBajo}
            onCheckedChange={setSoloBajo}
            aria-label="Solo stock bajo"
          />
          Solo stock bajo
        </label>
        <Button
          className="ml-auto"
          onClick={() => setVentana({ tipo: "producto", producto: null })}
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Nuevo producto
        </Button>
      </div>

      {productos.length === 0 ? (
        <Vacio
          icono={Package}
          titulo="Todavía no hay productos"
          texto="Crea los productos que vendes con su precio y sus existencias para venderlos en el panel."
          accion={
            <Button
              onClick={() => setVentana({ tipo: "producto", producto: null })}
            >
              Crear producto
            </Button>
          }
        />
      ) : lista.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ac-borde-fuerte bg-ac-papel px-4 py-8 text-center text-ac-pizarra">
          {soloBajo
            ? "Ningún producto está en stock bajo."
            : "Ningún producto coincide con la búsqueda."}
        </p>
      ) : (
        <>
          <table className="hidden w-full table-fixed overflow-hidden rounded-lg border border-ac-borde bg-ac-papel text-sm lg:table">
            <thead className="bg-ac-niebla text-left text-xs font-semibold text-ac-pizarra">
              <tr>
                <th className="px-3 py-2.5">Producto</th>
                <th className="w-24 px-3 py-2.5 text-right">Precio</th>
                <th className="w-40 px-3 py-2.5">Existencias</th>
                <th className="w-20 px-3 py-2.5 text-right">Mínimo</th>
                <th className="w-52 px-3 py-2.5">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ac-borde">
              {lista.map((p) => (
                <tr key={p.id} className={cn(!p.activo && "text-ac-pizarra")}>
                  <td className="px-3 py-2.5">
                    <NombreProducto p={p} />
                  </td>
                  <td className="cifras px-3 py-2.5 text-right">
                    {pesos(p.precio)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="cifras w-10 text-right font-semibold">
                        {p.existencias}
                      </span>
                      <EstadoExistencias p={p} />
                    </span>
                  </td>
                  <td className="cifras px-3 py-2.5 text-right text-ac-pizarra">
                    {p.stockMinimo || "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex justify-end">
                      <Acciones
                        p={p}
                        abrir={setVentana}
                        borrar={() => borrar(p)}
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="space-y-2 lg:hidden">
            {lista.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-lg border border-ac-borde bg-ac-papel px-3 py-3"
              >
                <span className="min-w-0 flex-1">
                  <NombreProducto p={p} />
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ac-pizarra">
                    <span className="cifras">{pesos(p.precio)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="cifras">
                      <strong className="text-ac-tinta">{p.existencias}</strong>{" "}
                      {p.existencias === 1 ? "unidad" : "unidades"}
                    </span>
                    <EstadoExistencias p={p} />
                  </span>
                </span>
                <Acciones p={p} abrir={setVentana} borrar={() => borrar(p)} />
              </li>
            ))}
          </ul>
        </>
      )}

      {ventana?.tipo === "producto" ? (
        <ModalProducto
          producto={actual}
          categorias={categorias}
          onCerrar={() => setVentana(null)}
        />
      ) : null}
      {ventana?.tipo === "existencias" && actual ? (
        <VentanaExistencias
          producto={actual}
          onCerrar={() => setVentana(null)}
        />
      ) : null}
      {ventana?.tipo === "historial" && actual ? (
        <HistorialProducto
          producto={actual}
          onCerrar={() => setVentana(null)}
        />
      ) : null}
      {dialogo}
    </>
  );
}
