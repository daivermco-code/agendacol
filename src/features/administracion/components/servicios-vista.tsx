"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  GripVertical,
  Info,
  MoreVertical,
  Pencil,
  Plus,
  Scissors,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirmar } from "@/shared/components/confirmar";
import { Vacio } from "@/shared/components/vacio";
import { duracion, pesos } from "@/shared/lib/formato";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { borrarCategoria, borrarServicio, ordenarServicios } from "../actions";
import type { DatosServicio, TipoServicio } from "../schemas";
import type { Catalogo, ServicioVista } from "../services/catalogo";
import { ModalCategoria } from "./modal-categoria";
import { FormularioServicio } from "./formulario-servicio";

const NUEVO: DatosServicio = {
  nombre: "",
  categoriaId: "",
  precio: Number.NaN,
  duracionMin: 30,
  descripcion: "",
  profesionales: [],
  enLinea: true,
  mostrarPrecio: true,
  mostrarDuracion: true,
  imagenes: [],
  activo: true,
};

const DETALLE_TIPO: Partial<
  Record<TipoServicio, (s: ServicioVista) => string>
> = {
  sesiones: (s) => `${s.sesiones} sesiones`,
  clase: (s) => `Cupo ${s.cupo}`,
  paquete: (s) => `${s.incluye.length} servicios`,
};

const TEXTO_TIPO: Record<
  TipoServicio,
  { nuevo: string; vacio: string; ayuda: string }
> = {
  servicio: {
    nuevo: "Servicio",
    vacio: "Todavía no hay servicios",
    ayuda:
      "cada servicio con su precio, duración, imágenes y quién lo hace. Agrúpalos en categorías y ordénalos arrastrando.",
  },
  sesiones: { nuevo: "Servicio con sesiones", vacio: "", ayuda: "" },
  clase: {
    nuevo: "Clase",
    vacio: "Todavía no hay clases",
    ayuda:
      "un horario con cupo para varios clientes, como un taller. Créala aquí y agéndala desde la agenda.",
  },
  paquete: {
    nuevo: "Paquete",
    vacio: "Todavía no hay paquetes",
    ayuda:
      "varios servicios a un precio. Se vende en la caja y cada servicio se agenda aparte.",
  },
};

function FilaServicio({
  s,
  onEditar,
  onBorrar,
  arrastrable,
}: {
  s: ServicioVista;
  onEditar: () => void;
  onBorrar: () => void;
  arrastrable: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: s.id,
    disabled: !arrastrable,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-ac-borde bg-ac-papel px-2 py-3 sm:px-3",
        isDragging && "relative z-10 shadow-flota",
      )}
    >
      <button
        type="button"
        className={cn(
          "area-tactil cursor-grab touch-none rounded p-1 text-ac-neblina hover:bg-ac-niebla",
          !arrastrable && "invisible",
        )}
        aria-label={`Mover ${s.nombre}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          {s.nombre}
          {DETALLE_TIPO[s.tipo] ? (
            <span className="ml-2 rounded-full bg-ac-laguna-claro px-2 py-0.5 text-xs font-medium text-ac-laguna-hondo">
              {DETALLE_TIPO[s.tipo]?.(s)}
            </span>
          ) : null}
          {!s.activo ? (
            <span className="ml-2 rounded-full bg-ac-niebla-oscura px-2 py-0.5 text-xs font-medium text-ac-pizarra">
              Inactivo
            </span>
          ) : null}
        </span>
        {/* En tableta y celular la duración y el precio van debajo del nombre. */}
        <span className="cifras block text-xs text-ac-pizarra lg:hidden">
          {duracion(s.duracionMin)} · {pesos(s.precio)}
        </span>
      </span>
      <span className="cifras hidden w-[180px] items-center justify-end gap-3 text-ac-pizarra lg:flex">
        {duracion(s.duracionMin)}{" "}
        <span className="h-3 w-px bg-ac-borde-fuerte" aria-hidden="true" />{" "}
        <span className="w-[76px] text-right text-ac-tinta">
          {pesos(s.precio)}
        </span>
      </span>
      <Button variant="outline" size="sm" onClick={onEditar} className="ml-2">
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />{" "}
        <span className="sr-only sm:not-sr-only">Editar</span>
        <span className="sr-only"> {s.nombre}</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="area-tactil rounded-md p-1.5 hover:bg-ac-niebla"
          aria-label={`Más opciones de ${s.nombre}`}
        >
          <MoreVertical className="h-4 w-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onBorrar} className="text-ac-error">
            <Trash2 aria-hidden="true" /> Borrar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

export function ServiciosVista({
  catalogo: todo,
  negocioId,
  tipos,
}: {
  catalogo: Catalogo;
  negocioId: string;
  /** Tipos de la pestaña (Servicios trae también los de sesiones). */
  tipos: TipoServicio[];
}) {
  const catalogo = {
    ...todo,
    servicios: todo.servicios.filter((s) => tipos.includes(s.tipo)),
  };
  const principal = tipos[0];
  const textos = TEXTO_TIPO[principal];
  const nuevo = (tipo: TipoServicio) =>
    setEditando({
      ...NUEVO,
      tipo,
      duracionMin: tipo === "clase" ? 60 : NUEVO.duracionMin,
      cupo: tipo === "clase" ? 8 : null,
      sesiones: tipo === "sesiones" ? 4 : null,
      vigenciaDias: tipo === "sesiones" || tipo === "paquete" ? 180 : null,
      enLinea:
        tipo === "servicio" || tipo === "sesiones" ? NUEVO.enLinea : false,
      categoriaId: todo.categorias[0]?.id ?? "",
    });
  const [orden, setOrden] = useState(catalogo.servicios.map((s) => s.id));
  const [filtro, setFiltro] = useState("");
  const [editando, setEditando] = useState<DatosServicio | null>(null);
  const [categoria, setCategoria] = useState<{
    id?: string;
    nombre: string;
  } | null>(null);
  const [, iniciar] = useTransicionRed();
  const [dialogo, confirmar] = useConfirmar();
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Si el servidor trae servicios nuevos, se agregan al final del orden local.
  const ids = [
    ...orden.filter((id) => catalogo.servicios.some((s) => s.id === id)),
    ...catalogo.servicios.filter((s) => !orden.includes(s.id)).map((s) => s.id),
  ];
  const porId = new Map(catalogo.servicios.map((s) => [s.id, s]));
  const texto = filtro.trim().toLowerCase();

  function alSoltar(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const nuevo = arrayMove(
      ids,
      ids.indexOf(String(e.active.id)),
      ids.indexOf(String(e.over.id)),
    );
    setOrden(nuevo);
    iniciar(async () => {
      const r = await ordenarServicios(nuevo);
      if (!r.ok) toast.error(r.error);
    });
  }

  async function confirmarBorrar(s: ServicioVista) {
    const ok = await confirmar({
      titulo: `¿Borrar "${s.nombre}"?`,
      texto: "Si ya tiene citas, se desactiva en vez de borrarse.",
      aceptar: "Borrar",
      peligro: true,
    });
    if (!ok) return;
    iniciar(async () => {
      const r = await borrarServicio(s.id);
      if (r.ok) toast.success(r.aviso ?? "Servicio borrado");
      else toast.error(r.error, { duration: Infinity });
    });
  }

  async function confirmarBorrarCategoria(c: { id: string; nombre: string }) {
    const ok = await confirmar({
      titulo: `¿Borrar la categoría "${c.nombre}"?`,
      aceptar: "Borrar",
      peligro: true,
    });
    if (!ok) return;
    iniciar(async () => {
      const r = await borrarCategoria(c.id);
      if (r.ok) toast.success("Categoría borrada");
      else toast.error(r.error, { duration: Infinity });
    });
  }

  return (
    <>
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-[#B9D7F4] dark:border-ac-info/30 bg-ac-info-fondo px-4 py-3 text-ac-info">
        <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p>
          <strong>
            {principal === "servicio"
              ? "Arma tu catálogo:"
              : `${textos.nuevo}:`}
          </strong>{" "}
          {textos.ayuda}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ac-neblina"
            aria-hidden="true"
          />
          <Input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar servicio"
            className="pl-9"
            aria-label="Buscar servicio"
          />
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCategoria({ nombre: "" })}
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Nueva categoría
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button data-guia="servicios">
                <Plus className="h-4 w-4" aria-hidden="true" /> Nuevo{" "}
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(["servicio", "sesiones", "clase", "paquete"] as const).map(
                (t) => (
                  <DropdownMenuItem key={t} onSelect={() => nuevo(t)}>
                    {TEXTO_TIPO[t].nuevo}
                  </DropdownMenuItem>
                ),
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {catalogo.servicios.length === 0 ? (
        <Vacio
          icono={Scissors}
          titulo={textos.vacio}
          texto={
            principal === "servicio"
              ? "Crea el primero con su precio y su duración para poder agendarlo."
              : `Así es ${textos.ayuda}`
          }
          accion={
            <Button onClick={() => nuevo(principal)}>
              Crear {textos.nuevo.toLowerCase()}
            </Button>
          }
        />
      ) : (
        <DndContext
          id="servicios"
          sensors={sensores}
          collisionDetection={closestCenter}
          onDragEnd={alSoltar}
        >
          <div className="space-y-5">
            {catalogo.categorias.map((c) => {
              const lista = ids
                .map((id) => porId.get(id))
                .filter(
                  (s): s is ServicioVista =>
                    !!s &&
                    s.categoriaId === c.id &&
                    (!texto || s.nombre.toLowerCase().includes(texto)),
                );
              if ((texto || principal !== "servicio") && lista.length === 0)
                return null;
              return (
                <section key={c.id} aria-label={c.nombre}>
                  <div className="mb-2 flex items-center gap-1">
                    <h2 className="font-semibold">{c.nombre}</h2>
                    <span className="text-sm text-ac-neblina">
                      ({lista.length})
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="area-tactil rounded-md p-1 hover:bg-ac-niebla-oscura"
                        aria-label={`Opciones de ${c.nombre}`}
                      >
                        <MoreVertical className="h-4 w-4" aria-hidden="true" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => setCategoria(c)}>
                          <Pencil aria-hidden="true" /> Renombrar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => confirmarBorrarCategoria(c)}
                          className="text-ac-error"
                        >
                          <Trash2 aria-hidden="true" /> Borrar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {lista.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-ac-borde px-4 py-3 text-sm text-ac-neblina">
                      Sin servicios en esta categoría.
                    </p>
                  ) : (
                    <SortableContext
                      items={lista.map((s) => s.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <ul className="space-y-2">
                        {lista.map((s) => (
                          <FilaServicio
                            key={s.id}
                            s={s}
                            arrastrable={!texto}
                            onEditar={() => setEditando(s)}
                            onBorrar={() => confirmarBorrar(s)}
                          />
                        ))}
                      </ul>
                    </SortableContext>
                  )}
                </section>
              );
            })}
          </div>
        </DndContext>
      )}

      {editando ? (
        <FormularioServicio
          catalogo={todo}
          negocioId={negocioId}
          inicial={editando}
          onCerrar={() => setEditando(null)}
        />
      ) : null}
      {categoria ? (
        <ModalCategoria
          inicial={categoria}
          onCerrar={() => setCategoria(null)}
        />
      ) : null}
      {dialogo}
    </>
  );
}
