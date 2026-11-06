"use client";

import { useEffect, useRef, useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowDownUp,
  Eye,
  Info,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { usePuede } from "@/features/auth/components/proveedor-miembro";
import { BotonExportar } from "@/shared/components/boton-exportar";
import { useConfirmar } from "@/shared/components/confirmar";
import { EditarColumnas } from "@/shared/components/editar-columnas";
import { Paginacion } from "@/shared/components/paginacion";
import { Vacio } from "@/shared/components/vacio";
import { useColumnas } from "@/shared/hooks/use-columnas";
import { enlaceExportar } from "@/shared/lib/csv";
import { telefono } from "@/shared/lib/formato";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { borrarCliente } from "../actions";
import { COLUMNAS_CLIENTES } from "../lib/columnas";
import { CLIENTE_VACIO } from "../schemas";
import type { FilaCliente, FiltrosClientes } from "../services/clientes";
import {
  FiltrosClientesPanel,
  SIN_FILTROS,
  type FiltrosAvanzados,
} from "./filtros-clientes";
import { ModalCliente } from "./modal-cliente";

const POR_DEFECTO: FiltrosClientes = {
  ...SIN_FILTROS,
  q: "",
  pagina: 1,
  por: 25,
  orden: "apellido",
  dir: "asc",
};

type Orden = FiltrosClientes["orden"];
const COLUMNAS: { clave: Orden; nombre: string; clase?: string }[] = [
  { clave: "nombre", nombre: "Nombre" },
  { clave: "apellido", nombre: "Apellido" },
  { clave: "correo", nombre: "Correo", clase: "hidden lg:table-cell" },
  { clave: "telefono", nombre: "Teléfono", clase: "hidden md:table-cell" },
  { clave: "documento", nombre: "Documento", clase: "hidden xl:table-cell" },
];

function Encabezado({
  nombre,
  activa,
  dir,
  clase,
  onOrden,
}: {
  nombre: string;
  activa: boolean;
  dir: "asc" | "desc";
  clase?: string;
  onOrden: () => void;
}) {
  return (
    <th
      scope="col"
      className={cn("px-3 py-2.5 text-left font-semibold", clase)}
      aria-sort={
        activa ? (dir === "asc" ? "ascending" : "descending") : undefined
      }
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-ac-laguna-hondo"
        onClick={onOrden}
      >
        {nombre}
        <ArrowDownUp
          className={cn(
            "h-3.5 w-3.5",
            activa ? "text-ac-laguna" : "text-ac-neblina",
          )}
          aria-hidden="true"
        />
      </button>
    </th>
  );
}

/** Base de clientes: filtros avanzados, buscador, tabla ordenable y páginas (estado en la dirección). */
export function BaseClientes({
  filas,
  total,
  filtros,
  profesionales,
  servicios,
}: {
  filas: FilaCliente[];
  total: number;
  filtros: FiltrosClientes;
  profesionales: { id: string; nombre: string }[];
  servicios: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const ruta = usePathname();
  const puedo = usePuede();
  const [cargando, iniciar] = useTransicionRed();
  const [texto, setTexto] = useState(filtros.q);
  const [nuevo, setNuevo] = useState(false);
  const [dialogo, confirmar] = useConfirmar();
  const primera = useRef(true);
  const columnas = useColumnas("clientes", COLUMNAS_CLIENTES);

  const ir = (cambio: Partial<FiltrosClientes>) => {
    const f = { ...filtros, pagina: 1, ...cambio };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(f))
      if (v !== POR_DEFECTO[k as keyof FiltrosClientes]) p.set(k, String(v));
    const q = p.toString();
    iniciar(() => router.push(q ? `${ruta}?${q}` : ruta, { scroll: false }));
  };

  // Busca solo tras una pausa al escribir.
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    const id = window.setTimeout(() => {
      if (texto.trim() !== filtros.q) ir({ q: texto.trim() });
    }, 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  const conFiltros =
    filtros.q !== "" ||
    Object.keys(SIN_FILTROS).some(
      (k) => filtros[k as keyof FiltrosAvanzados] !== "",
    );
  const ordenar = (clave: Orden) =>
    ir({
      orden: clave,
      dir: filtros.orden === clave && filtros.dir === "asc" ? "desc" : "asc",
    });

  async function borrar(c: FilaCliente) {
    const si = await confirmar({
      titulo: `¿Borrar a ${c.nombre} ${c.apellido}?`,
      texto: "Solo se puede borrar un cliente sin reservas ni ventas.",
      aceptar: "Borrar",
      peligro: true,
    });
    if (!si) return;
    const r = await borrarCliente(c.id);
    if (r.ok) toast.success("Cliente borrado");
    else toast.error(r.error);
  }

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-4 lg:px-6 lg:py-6">
      <div className="flex items-center gap-3">
        <h1 className="flex-1 text-[28px] font-bold leading-tight tracking-tight md:text-2xl">
          Base de clientes
        </h1>
        <Button
          variant="outline"
          className="hidden md:inline-flex"
          onClick={() =>
            toast.info("En la demo los clientes no se importan desde archivos.")
          }
        >
          <Upload className="h-4 w-4" aria-hidden="true" /> Importar clientes
        </Button>
        {puedo("editar_clientes") ? (
          <Button onClick={() => setNuevo(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Nuevo cliente
          </Button>
        ) : null}
      </div>
      <p className="mt-3 flex items-start gap-2 rounded-lg border border-ac-info/30 bg-ac-info-fondo px-3 py-2.5 text-sm text-ac-info md:hidden">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        Importa, descarga y combina clientes desde el computador.
      </p>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[280px_1fr]">
        <div className="hidden md:block">
          <FiltrosClientesPanel
            key={JSON.stringify(filtros)}
            inicial={filtros}
            profesionales={profesionales}
            servicios={servicios}
            onAplicar={(f) => ir({ ...f, pagina: 1 })}
          />
        </div>
        <section
          aria-label="Clientes"
          className={cn(
            "min-w-0 rounded-lg border border-ac-borde bg-ac-papel shadow-quieta transition-opacity",
            cargando && "opacity-60",
          )}
          aria-busy={cargando}
        >
          <div className="flex items-center gap-2 border-b border-ac-borde p-4">
            <label className="relative block max-w-xl flex-1">
              <span className="sr-only">Buscar clientes</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ac-neblina"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Busca por nombre, apellido, documento, correo o teléfono"
                className="pl-9"
              />
            </label>
            <div className="ml-auto hidden gap-2 md:flex">
              <EditarColumnas
                todas={COLUMNAS_CLIENTES}
                visibles={columnas.visibles}
                onCambio={columnas.cambiar}
              />
              <BotonExportar
                href={enlaceExportar("clientes", filtros, columnas.visibles)}
              />
            </div>
          </div>
          <div className="p-4">
            {total === 0 ? (
              conFiltros ? (
                <Vacio
                  icono={Search}
                  titulo={
                    filtros.q
                      ? `Nadie coincide con «${filtros.q}»`
                      : "Nadie coincide con estos filtros"
                  }
                  texto="Revisa lo que escribiste o quita algún filtro."
                />
              ) : (
                <Vacio
                  icono={Users}
                  titulo="Aún no tienes clientes"
                  texto="Crea el primero o agrégalo desde una reserva."
                  accion={
                    <Button onClick={() => setNuevo(true)}>
                      <Plus className="h-4 w-4" aria-hidden="true" /> Nuevo
                      cliente
                    </Button>
                  }
                />
              )
            ) : (
              <>
                <p className="cifras pb-2 text-right text-[13px] text-ac-pizarra">
                  Mostrando {filas.length} de {total} clientes
                </p>
                <div className="overflow-hidden rounded-lg border border-ac-borde">
                  <table className="w-full text-sm">
                    <thead className="bg-ac-niebla text-ac-tinta">
                      <tr>
                        <th
                          scope="col"
                          className="px-3 py-2.5 text-left font-semibold md:hidden"
                        >
                          <button
                            type="button"
                            className="inline-flex min-h-11 items-center gap-1 md:min-h-0"
                            onClick={() => ordenar("apellido")}
                          >
                            Nombre y apellido
                            <ArrowDownUp
                              className="h-3.5 w-3.5 text-ac-laguna"
                              aria-hidden="true"
                            />
                          </button>
                        </th>
                        {COLUMNAS.filter((c) => columnas.ver(c.clave)).map(
                          (c) => (
                            <Encabezado
                              key={c.clave}
                              nombre={c.nombre}
                              activa={filtros.orden === c.clave}
                              dir={filtros.dir}
                              clase={c.clase ?? "hidden md:table-cell"}
                              onOrden={() => ordenar(c.clave)}
                            />
                          ),
                        )}
                        <th
                          scope="col"
                          className="w-28 px-3 py-2.5 text-center font-semibold"
                        >
                          Opciones
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((c) => (
                        <tr
                          key={c.id}
                          className="border-t border-ac-borde odd:bg-ac-papel even:bg-ac-niebla/50"
                        >
                          <td className="px-3 py-2.5 md:hidden">
                            {c.nombre} {c.apellido}
                          </td>
                          <td className="hidden px-3 py-2.5 md:table-cell">
                            {c.nombre}
                          </td>
                          <td className="hidden px-3 py-2.5 md:table-cell">
                            {c.apellido}
                          </td>
                          {columnas.ver("correo") ? (
                            <td className="hidden max-w-[240px] truncate px-3 py-2.5 lg:table-cell">
                              {c.correo}
                            </td>
                          ) : null}
                          {columnas.ver("telefono") ? (
                            <td className="cifras hidden whitespace-nowrap px-3 py-2.5 md:table-cell">
                              {telefono(c.telefono)}
                            </td>
                          ) : null}
                          {columnas.ver("documento") ? (
                            <td className="cifras hidden px-3 py-2.5 xl:table-cell">
                              {c.documento}
                            </td>
                          ) : null}
                          <td className="px-3 py-1.5">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                asChild
                                size="icon"
                                variant="outline"
                                className="md:h-8 md:w-8"
                              >
                                <Link
                                  href={`/clientes/${c.id}`}
                                  aria-label={`Ver ficha de ${c.nombre} ${c.apellido}`}
                                >
                                  <Eye className="h-4 w-4 text-ac-laguna" />
                                </Link>
                              </Button>
                              {puedo("editar_clientes") ? (
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="md:h-8 md:w-8"
                                  aria-label={`Borrar a ${c.nombre} ${c.apellido}`}
                                  onClick={() => void borrar(c)}
                                >
                                  <Trash2 className="h-4 w-4 text-ac-error" />
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Paginacion
                  pagina={filtros.pagina}
                  total={total}
                  porPagina={filtros.por}
                  onPagina={(p) => ir({ pagina: p })}
                  onPorPagina={(n) => ir({ por: n })}
                />
              </>
            )}
          </div>
        </section>
      </div>
      {nuevo ? (
        <ModalCliente
          inicial={CLIENTE_VACIO}
          onCerrar={() => setNuevo(false)}
          onGuardado={(c) => router.push(`/clientes/${c.id}`)}
        />
      ) : null}
      {dialogo}
    </main>
  );
}
