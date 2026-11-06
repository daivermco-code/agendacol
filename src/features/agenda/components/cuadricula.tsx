"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DndContext,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import { Clock } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { ColumnaGrid } from "../lib/columnas";
import { aHora } from "../lib/fechas";
import { filas, pxPorMinuto, type Escala } from "../lib/geometria";
import type { CitaAgenda, PedidoNuevo } from "../types";
import { Columna, type FiltroAgenda, type PermisosHueco } from "./columna";

export const ANCHO_HORAS = 45;

interface Props {
  columnas: ColumnaGrid[];
  cabecera: (col: ColumnaGrid) => ReactNode;
  escala: Escala;
  ahora: { fecha: string; minutos: number };
  anchoMinimo: number;
  /** Si viene, esas columnas llenan justo el ancho visible y la semana se desliza de a días enteros. */
  columnasVisibles?: number;
  colores: Map<string, { color: string; nombre: string }> | null;
  /** Carriles como máximo por columna; los que no caben van en "+N más" (celular). */
  topeCarriles?: number;
  /** Búsqueda del celular: solo se dibujan estas citas y clases (las demás siguen ocupando su hora). */
  filtro?: FiltroAgenda | null;
  permisos: PermisosHueco;
  cargando?: boolean;
  onNuevo: (pedido: PedidoNuevo) => void;
  onCita?: (cita: CitaAgenda, el: HTMLElement) => void;
  onBloqueo?: (bloqueoId: string) => void;
  /** Avisa que empezó un arrastre (el celular deja de contar ese toque como deslizar de lado). */
  onEmpiezaArrastre?: () => void;
  /** Si viene, las citas se arrastran (dueño y recepción). */
  onMover?: (
    cita: CitaAgenda,
    destino: { fecha: string; inicio: number; profesionalId: string },
  ) => void;
}

interface DatosColumna {
  fecha: string;
  profesionalId: string | null;
}

/** Cuadrícula de horas × columnas (días o profesionales) con cabecera y horas fijas al desplazar. */
export function Cuadricula(p: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const primeraHoy = p.columnas.findIndex((c) => c.fecha === p.ahora.fecha);
  const claveRango = `${p.columnas[0]?.clave}-${p.columnas.length}`;

  // En celular la semana se desliza: al cambiar de rango, deja a la vista la columna de hoy (el sábado y el
  // domingo el navegador se detiene al final, que coincide con un borde de columna por columnasVisibles).
  useEffect(() => {
    const el = caja.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const celda =
      el.querySelectorAll<HTMLElement>("[role=gridcell]")[
        Math.max(primeraHoy, 0)
      ];
    el.scrollLeft = celda ? celda.offsetLeft - ANCHO_HORAS : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveRango]);

  const [sel, setSel] = useState<{ clave: string; minuto: number } | null>(
    null,
  );
  const onSeleccion = useCallback(
    (clave: string, minuto: number | null) =>
      setSel(minuto === null ? null : { clave, minuto }),
    [],
  );
  const px = pxPorMinuto(p.escala);
  const arrastre = useMemo(
    () =>
      p.onMover
        ? { pasoPx: p.escala.bloque * px, bloque: p.escala.bloque }
        : undefined,
    [p.onMover, p.escala.bloque, px],
  );
  // Ratón: se arrastra al moverlo 6 px. Táctil: presión larga (300 ms, T-12.7) para no robarle el desplazamiento.
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 300, tolerance: 8 },
    }),
  );
  const enFila: Modifier = ({ transform }) =>
    arrastre
      ? {
          ...transform,
          y: Math.round(transform.y / arrastre.pasoPx) * arrastre.pasoPx,
        }
      : transform;
  const ultimoArrastre = useRef(0);
  const { onCita, onMover } = p;
  const abrir = useCallback(
    (c: CitaAgenda, el: HTMLElement) => {
      if (Date.now() - ultimoArrastre.current > 300) onCita?.(c, el);
    },
    [onCita],
  );
  const alSoltar = (e: DragEndEvent) => {
    ultimoArrastre.current = Date.now();
    const cita = e.active.data.current?.cita as CitaAgenda | undefined;
    const col = e.over?.data.current as DatosColumna | undefined;
    if (!cita || !col || !onMover || !arrastre) return;
    const filas = Math.round(e.delta.y / arrastre.pasoPx);
    const inicio = Math.max(
      0,
      Math.min(
        cita.inicio + filas * arrastre.bloque,
        24 * 60 - cita.duracionMin,
      ),
    );
    const profesionalId = col.profesionalId ?? cita.profesionalId;
    if (
      inicio === cita.inicio &&
      col.fecha === cita.fecha &&
      profesionalId === cita.profesionalId
    )
      return;
    onMover(cita, { fecha: col.fecha, inicio, profesionalId });
  };
  const hayHoy = p.columnas.some((c) => c.fecha === p.ahora.fecha);
  const ahoraVisible =
    hayHoy &&
    p.ahora.minutos >= p.escala.inicio &&
    p.ahora.minutos <= p.escala.fin;

  return (
    <DndContext
      id="agenda"
      sensors={sensores}
      collisionDetection={pointerWithin}
      modifiers={[enFila]}
      onDragStart={(e) => {
        setSel(null);
        p.onEmpiezaArrastre?.();
        // Con el dedo, un toque corto de vibración confirma que la cita ya se puede mover. Chrome solo deja
        // vibrar después de que la persona tocó la página, y si no, avisa en la consola: se pregunta antes.
        if (
          "touches" in e.activatorEvent &&
          navigator.userActivation?.hasBeenActive
        )
          navigator.vibrate?.(15);
      }}
      onDragEnd={alSoltar}
      accessibility={{ restoreFocus: false }}
    >
      <div
        ref={caja}
        role="grid"
        aria-busy={p.cargando || undefined}
        className="relative min-h-0 flex-1 overflow-auto overscroll-contain bg-ac-papel print:overflow-visible"
      >
        <div
          style={{
            minWidth: p.columnasVisibles
              ? `calc(${ANCHO_HORAS}px + ${p.columnas.length} * (100% - ${ANCHO_HORAS}px) / ${p.columnasVisibles})`
              : ANCHO_HORAS + p.columnas.length * p.anchoMinimo,
          }}
        >
          <div
            role="row"
            className="sticky top-0 z-20 flex border-b border-ac-borde bg-ac-papel"
          >
            <div
              role="columnheader"
              className="sticky left-0 z-30 flex shrink-0 items-center justify-center bg-ac-papel text-ac-neblina"
              style={{ width: ANCHO_HORAS }}
            >
              <Clock className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Horas</span>
            </div>
            {p.columnas.map((c) => (
              <div
                key={c.clave}
                role="columnheader"
                className="min-w-0 flex-1 border-l border-transparent"
                style={{ minWidth: p.anchoMinimo }}
              >
                {p.cabecera(c)}
              </div>
            ))}
          </div>
          <div
            role="row"
            className={cn(
              "relative flex",
              p.cargando && "opacity-60 transition-opacity",
            )}
          >
            <div
              className="sticky left-0 z-10 shrink-0 bg-ac-papel"
              style={{ width: ANCHO_HORAS }}
            >
              {filas(p.escala).map((m) => (
                <div
                  key={m}
                  className="cifras flex items-center justify-end pr-1.5 text-[12px] text-ac-pizarra"
                  style={{ height: p.escala.bloque * px }}
                >
                  {aHora(m)}
                </div>
              ))}
              {ahoraVisible ? (
                <span
                  className="cifras absolute right-0.5 z-[7] -translate-y-1/2 rounded-full bg-ac-laguna px-1 text-[11px] font-semibold leading-[16px] text-ac-papel"
                  style={{ top: (p.ahora.minutos - p.escala.inicio) * px }}
                >
                  {aHora(p.ahora.minutos)}
                </span>
              ) : null}
            </div>
            {p.columnas.map((c, i) => (
              <Columna
                key={c.clave}
                col={c}
                escala={p.escala}
                ahoraMinuto={c.fecha === p.ahora.fecha ? p.ahora.minutos : null}
                ahoraPunto={i === primeraHoy}
                anchoMinimo={p.anchoMinimo}
                colores={p.colores}
                topeCarriles={p.topeCarriles}
                filtro={p.filtro}
                permisos={p.permisos}
                seleccion={sel?.clave === c.clave ? sel.minuto : null}
                onSeleccion={onSeleccion}
                onNuevo={p.onNuevo}
                onCita={abrir}
                onBloqueo={p.onBloqueo}
                arrastre={arrastre}
              />
            ))}
          </div>
        </div>
      </div>
    </DndContext>
  );
}
