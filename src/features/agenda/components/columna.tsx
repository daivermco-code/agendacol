"use client";

import { memo, useMemo, useState, type MouseEvent } from "react";
import { useDroppable } from "@dnd-kit/core";
import { CalendarPlus, Plus, Ban, Users, X } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import type { ColumnaGrid } from "../lib/columnas";
import { aHora, tituloCorto } from "../lib/fechas";
import { caja, minutoEn, pxPorMinuto, type Escala } from "../lib/geometria";
import { ocupado } from "../lib/horario";
import { repartirConTope, type Mas } from "../lib/reparto";
import type { CitaAgenda, PedidoNuevo } from "../types";
import { useClases } from "@/features/clases/store/clases";
import {
  BloqueBloqueo,
  BloqueCita,
  BloqueClase,
  type Arrastre,
} from "./piezas";
import { cn } from "@/shared/lib/utils";
import { useEsCelular } from "@/shared/hooks/use-es-celular";
import { HojaHueco } from "./hoja-hueco";
import { HojaMas } from "./hoja-mas";

/** Lo que se ve con la búsqueda puesta (ids de citas y de clases). */
export interface FiltroAgenda {
  citas: Set<string>;
  clases: Set<string>;
}

export interface PermisosHueco {
  reserva: boolean;
  bloqueo: boolean;
  /** "Nueva venta" en la hoja del celular. */
  venta?: boolean;
}

interface Props {
  col: ColumnaGrid;
  escala: Escala;
  ahoraMinuto: number | null;
  /** El punto de la línea de ahora va solo en la primera columna de hoy. */
  ahoraPunto: boolean;
  anchoMinimo: number;
  colores: Map<string, { color: string; nombre: string }> | null;
  /** Carriles como máximo; los que no caben van en "+N más" (celular, T-12.6). */
  topeCarriles?: number;
  filtro?: FiltroAgenda | null;
  permisos: PermisosHueco;
  seleccion: number | null;
  onSeleccion: (clave: string, minuto: number | null) => void;
  onNuevo: (pedido: PedidoNuevo) => void;
  onCita?: (cita: CitaAgenda, el: HTMLElement) => void;
  onBloqueo?: (bloqueoId: string) => void;
  /** Solo si se pueden mover citas. */
  arrastre?: Arrastre;
}

/** Una columna de la cuadrícula: gris fuera de horario, citas repartidas, ahora, hueco al pasar y al tocar. */
export const Columna = memo(function Columna(p: Props) {
  const { col, escala } = p;
  const [hover, setHover] = useState<number | null>(null);
  // Con la fecha: en la vista día la columna es la misma al cambiar de día, y la hoja no debe quedar abierta.
  const [masAbierto, setMasAbierto] = useState<{
    fecha: string;
    mas: Mas;
  } | null>(null);
  const px = pxPorMinuto(escala);
  const altoTotal = (escala.fin - escala.inicio) * px;
  const altoBloque = escala.bloque * px;
  const puedeAgregar = p.permisos.reserva || p.permisos.bloqueo;
  const abrirClase = useClases((e) => e.abrir);
  const { setNodeRef, isOver } = useDroppable({
    id: col.clave,
    data: { fecha: col.fecha, profesionalId: col.profesional?.id ?? null },
    disabled: !p.arrastre,
  });

  const ocupados = useMemo(
    () => [
      ...col.citas.filter((c) => c.estado !== "cancelado"),
      ...col.bloqueos,
      ...col.clases,
    ],
    [col],
  );
  const citasVisibles = useMemo(
    () =>
      p.filtro ? col.citas.filter((c) => p.filtro?.citas.has(c.id)) : col.citas,
    [col, p.filtro],
  );
  const clasesVisibles = useMemo(
    () =>
      p.filtro
        ? col.clases.filter((k) => p.filtro?.clases.has(k.id))
        : col.clases,
    [col, p.filtro],
  );
  const { lugares, mas } = useMemo(
    () =>
      repartirConTope(
        [
          ...citasVisibles.map((c) => ({
            id: c.id,
            inicio: c.inicio,
            fin: c.fin,
          })),
          ...col.bloqueos.map((b) => ({
            id: `b:${b.id}`,
            inicio: b.inicio,
            fin: b.fin,
          })),
          ...clasesVisibles.map((k) => ({
            id: `k:${k.id}`,
            inicio: k.inicio,
            fin: k.fin,
          })),
        ],
        p.topeCarriles ?? Infinity,
      ),
    [citasVisibles, clasesVisibles, col.bloqueos, p.topeCarriles],
  );
  const ocultos = useMemo(() => new Set(mas.flatMap((m) => m.ids)), [mas]);

  const minutoBajo = (e: MouseEvent<HTMLDivElement>) => {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const m = minutoEn(escala, y);
    return ocupado(ocupados, m, m + escala.bloque) ? null : m;
  };

  const ubicar = (id: string, inicio: number, fin: number) => {
    const u = lugares.get(id) ?? { columna: 0, columnas: 1 };
    return {
      ...caja(escala, inicio, fin),
      izquierda: (u.columna / u.columnas) * 100,
      ancho: 100 / u.columnas,
    };
  };

  return (
    <div
      ref={setNodeRef}
      role="gridcell"
      className={cn(
        "relative flex-1 border-l border-ac-borde",
        isOver && "bg-ac-laguna-claro/40",
      )}
      style={{
        minWidth: p.anchoMinimo,
        height: altoTotal,
        backgroundImage:
          "linear-gradient(to bottom, hsl(var(--ac-borde)) 1px, transparent 1px)",
        backgroundSize: `100% ${altoBloque}px`,
      }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || !puedeAgregar) return;
        if (!e.currentTarget.contains(e.target as Node)) return;
        setHover(minutoBajo(e));
      }}
      onPointerLeave={() => setHover(null)}
      onClick={(e) => {
        // Los clics dentro de una hoja (portal de vaul) suben por React hasta aquí: no son de la columna.
        if (!e.currentTarget.contains(e.target as Node)) return;
        const m = minutoBajo(e);
        if (m === null) return;
        if (!puedeAgregar) {
          toast.info(
            "Tu rol solo puede ver y cambiar el estado de sus citas.",
            {
              id: "sin-agregar",
            },
          );
          return;
        }
        p.onSeleccion(col.clave, m);
      }}
    >
      {col.cerrados.map((r) => (
        <div
          key={`${r.inicio}`}
          aria-hidden="true"
          className="absolute inset-x-0 bg-ac-niebla-oscura"
          style={{
            top: (r.inicio - escala.inicio) * px,
            height: (r.fin - r.inicio) * px,
          }}
        />
      ))}
      {col.bloqueos.map((b) =>
        ocultos.has(`b:${b.id}`) ? null : (
          <BloqueBloqueo
            key={`${b.id}-${b.fecha}`}
            bloqueo={b}
            caja={ubicar(`b:${b.id}`, b.inicio, b.fin)}
            onAbrir={p.onBloqueo}
          />
        ),
      )}
      {clasesVisibles.map((k) =>
        ocultos.has(`k:${k.id}`) ? null : (
          <BloqueClase
            key={k.id}
            clase={k}
            caja={ubicar(`k:${k.id}`, k.inicio, k.fin)}
            nombreProfesional={p.colores?.get(k.profesionalId)?.nombre}
            onAbrir={abrirClase}
          />
        ),
      )}
      {citasVisibles.map((c) => {
        if (ocultos.has(c.id)) return null;
        const prof = p.colores?.get(c.profesionalId);
        return (
          <BloqueCita
            key={c.id}
            cita={c}
            caja={ubicar(c.id, c.inicio, c.fin)}
            colorProfesional={prof?.color}
            nombreProfesional={prof?.nombre}
            arrastre={p.arrastre}
            onAbrir={p.onCita}
          />
        );
      })}
      {mas.map((m) => {
        const k = ubicarMas(escala, m);
        return (
          <button
            key={`mas-${m.inicio}`}
            type="button"
            data-mas=""
            aria-haspopup="dialog"
            aria-label={`Ver ${m.ids.length} más a las ${aHora(m.inicio)}`}
            className="absolute z-[2] flex items-start justify-center rounded-[6px] border border-ac-borde bg-ac-niebla px-0.5 pt-1 text-[12px] font-semibold text-ac-tinta"
            style={{
              top: k.top,
              height: k.alto,
              left: `calc(${k.izquierda}% + 1px)`,
              width: `calc(${k.ancho}% - 2px)`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              setMasAbierto({ fecha: col.fecha, mas: m });
            }}
          >
            +{m.ids.length} más
          </button>
        );
      })}
      {masAbierto?.fecha === col.fecha ? (
        <HojaMas
          titulo={`${tituloCorto("dia", col.fecha)} · ${aHora(masAbierto.mas.inicio)}`}
          ids={masAbierto.mas.ids}
          col={col}
          colores={p.colores}
          onCerrar={() => setMasAbierto(null)}
          onCita={p.onCita}
          onBloqueo={p.onBloqueo}
          onClase={abrirClase}
        />
      ) : null}
      {hover !== null && p.seleccion === null ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[2px] z-[3] flex items-center gap-1 rounded-[4px] border border-dashed border-ac-laguna bg-ac-laguna-claro/80 px-1.5 text-[12px] font-medium text-ac-laguna-hondo"
          style={{ top: (hover - escala.inicio) * px, height: altoBloque }}
        >
          <Plus className="h-3 w-3" />{" "}
          <span className="cifras">{aHora(hover)}</span>
        </div>
      ) : null}
      {p.seleccion !== null ? (
        <MenuHueco
          {...p}
          minuto={p.seleccion}
          top={(p.seleccion - escala.inicio) * px}
          alto={altoBloque}
        />
      ) : null}
      {p.ahoraMinuto !== null &&
      p.ahoraMinuto >= escala.inicio &&
      p.ahoraMinuto <= escala.fin ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 z-[6] h-[2px] bg-ac-laguna"
          style={{ top: (p.ahoraMinuto - escala.inicio) * px }}
        >
          {p.ahoraPunto ? (
            <span className="absolute -left-[5px] -top-[4px] h-[10px] w-[10px] rounded-full bg-ac-laguna" />
          ) : null}
        </div>
      ) : null}
    </div>
  );
});

/** Caja del botón "+N más": el último carril, de la primera a la última que esconde. */
function ubicarMas(escala: Escala, m: Mas) {
  return {
    ...caja(escala, m.inicio, m.fin),
    izquierda: (m.columna / m.columnas) * 100,
    ancho: 100 / m.columnas,
  };
}

function MenuHueco(p: Props & { minuto: number; top: number; alto: number }) {
  const esCelular = useEsCelular();
  const cerrar = () => p.onSeleccion(p.col.clave, null);
  const pedir = (tipo: PedidoNuevo["tipo"]) => {
    cerrar();
    p.onNuevo({
      tipo,
      fecha: p.col.fecha,
      minuto: p.minuto,
      profesionalId: p.col.profesional?.id ?? null,
      recursoId: p.col.recurso?.id ?? null,
    });
  };
  if (esCelular) {
    return (
      <>
        <div
          aria-hidden="true"
          className="absolute inset-x-[2px] z-[4] flex items-center gap-1 rounded-[4px] bg-ac-laguna px-1.5 text-[12px] font-semibold text-ac-papel"
          style={{ top: p.top, height: Math.max(p.alto, 20) }}
          onClick={(e) => e.stopPropagation()}
        >
          <Plus className="h-3 w-3" /> {aHora(p.minuto)}
        </div>
        <HojaHueco
          cuando={`${tituloCorto("dia", p.col.fecha)} · ${aHora(p.minuto)}`}
          permisos={p.permisos}
          onPedir={pedir}
          onCerrar={cerrar}
        />
      </>
    );
  }
  return (
    <DropdownMenu open onOpenChange={(abierto) => (abierto ? null : cerrar())}>
      <DropdownMenuTrigger asChild>
        <div
          className="absolute inset-x-[2px] z-[4] flex items-center justify-between rounded-[4px] bg-ac-laguna px-1.5 text-[12px] font-semibold text-ac-papel"
          style={{ top: p.top, height: Math.max(p.alto, 20) }}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="flex items-center gap-1">
            <Plus className="h-3 w-3" aria-hidden="true" /> Agregar
          </span>
          <X className="h-3 w-3" aria-hidden="true" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <div className="px-2 py-1 text-[12px] text-ac-pizarra cifras">
          {p.col.fecha.split("-").reverse().join("/")} · {aHora(p.minuto)}
        </div>
        {p.permisos.reserva ? (
          <DropdownMenuItem onSelect={() => pedir("reserva")}>
            <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Reserva
          </DropdownMenuItem>
        ) : null}
        {p.permisos.reserva ? (
          <DropdownMenuItem onSelect={() => pedir("clase")}>
            <Users className="h-4 w-4" aria-hidden="true" /> Clase
          </DropdownMenuItem>
        ) : null}
        {p.permisos.bloqueo ? (
          <DropdownMenuItem onSelect={() => pedir("bloqueo")}>
            <Ban className="h-4 w-4" aria-hidden="true" /> Bloquear horario
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
