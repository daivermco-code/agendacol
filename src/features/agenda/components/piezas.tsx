"use client";

import Image from "next/image";
import { useDraggable } from "@dnd-kit/core";
import { Lock, Users } from "lucide-react";
import { cn, iniciales } from "@/shared/lib/utils";
import { ESTADOS } from "../lib/estados";
import { aHora } from "../lib/fechas";
import type {
  BloqueoDia,
  CitaAgenda,
  ClaseAgenda,
  ProfesionalAgenda,
} from "../types";

interface Caja {
  top: number;
  alto: number;
  /** Porcentaje de la columna. */
  izquierda: number;
  ancho: number;
}

function estiloCaja(c: Caja) {
  return {
    top: c.top,
    height: c.alto,
    left: `calc(${c.izquierda}% + 2px)`,
    width: `calc(${c.ancho}% - 4px)`,
  };
}

/** Para arrastrar: alto en px de un bloque y sus minutos (el bloque salta de fila en fila). */
export interface Arrastre {
  pasoPx: number;
  bloque: number;
}

/** Bloque de una cita en la cuadrícula: borde y fondo del color de su estado; se arrastra si hay `arrastre`. */
export function BloqueCita({
  cita,
  caja,
  colorProfesional,
  nombreProfesional,
  arrastre,
  onAbrir,
}: {
  cita: CitaAgenda;
  caja: Caja;
  colorProfesional?: string;
  nombreProfesional?: string;
  arrastre?: Arrastre;
  onAbrir?: (cita: CitaAgenda, el: HTMLElement) => void;
}) {
  const color = ESTADOS[cita.estado];
  const movible = Boolean(arrastre) && cita.estado !== "cancelado";
  const { setNodeRef, attributes, listeners, transform, isDragging } =
    useDraggable({
      id: cita.id,
      data: { cita },
      disabled: !movible,
    });
  const filas =
    arrastre && transform ? Math.round(transform.y / arrastre.pasoPx) : 0;
  const etiqueta = [
    cita.clienteNombre,
    cita.servicioNombre,
    `${cita.horaInicio} – ${cita.horaFin}`,
    color.nombre,
    nombreProfesional ? `con ${nombreProfesional}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <button
      ref={setNodeRef}
      type="button"
      data-cita={cita.id}
      {...(movible ? listeners : {})}
      {...(movible
        ? { "aria-roledescription": attributes["aria-roledescription"] }
        : {})}
      aria-label={etiqueta}
      title={etiqueta}
      onClick={(e) => {
        e.stopPropagation();
        onAbrir?.(cita, e.currentTarget);
      }}
      className={cn(
        "absolute z-[2] select-none overflow-hidden rounded-[4px] border-l-[3px] px-1 py-px text-left text-[12px] leading-[15px] shadow-[0_0_0_1px_hsl(var(--ac-papel))] transition-shadow [-webkit-touch-callout:none] hover:z-[5] hover:shadow-flota focus-visible:z-[5]",
        movible && "touch-manipulation",
        isDragging && "z-[40] cursor-grabbing opacity-90 shadow-modal",
      )}
      style={{
        ...estiloCaja(caja),
        background: color.fondo,
        borderLeftColor: color.borde,
        color: color.texto,
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
      }}
    >
      {isDragging && arrastre ? (
        <span className="cifras absolute right-1 top-0.5 rounded bg-ac-tinta px-1 text-[11px] font-semibold text-ac-papel">
          {aHora(cita.inicio + filas * arrastre.bloque)}
        </span>
      ) : null}
      <span className="flex min-w-0 items-center gap-1 font-semibold">
        {cita.pagada || cita.pagoParcial ? (
          <span
            className={cn(
              "rounded-[3px] px-[3px] text-[10px] leading-[13px] text-ac-papel",
              cita.pagada ? "bg-ac-exito" : "bg-ac-aviso",
            )}
            title={cita.pagada ? "Pagada" : "Pago parcial"}
          >
            $
            <span className="sr-only">
              {cita.pagada ? " pagada" : " pago parcial"}
            </span>
          </span>
        ) : null}
        {cita.profesionalFijo ? (
          <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
        ) : null}
        {colorProfesional ? (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: colorProfesional }}
            aria-hidden="true"
          />
        ) : null}
        <span
          className={cn(
            "truncate",
            cita.estado === "cancelado" && "line-through",
          )}
        >
          {cita.clienteNombre}
        </span>
      </span>{" "}
      {caja.alto >= 30 ? (
        <span className="block truncate">{cita.servicioNombre}</span>
      ) : null}{" "}
      {caja.alto >= 46 ? (
        <span className="cifras block truncate opacity-80">
          {cita.horaInicio} – {cita.horaFin}
        </span>
      ) : null}
    </button>
  );
}

/** Franja rayada de un bloqueo (almuerzo, permiso…); con `onAbrir` se puede editar. */
export function BloqueBloqueo({
  bloqueo,
  caja,
  onAbrir,
}: {
  bloqueo: BloqueoDia;
  caja: Caja;
  onAbrir?: (bloqueoId: string) => void;
}) {
  const desde = aHora(bloqueo.inicio);
  const hasta = aHora(Math.min(bloqueo.fin, 1439));
  const rango = `${desde} – ${hasta}`;
  const Etiqueta = onAbrir ? "button" : "div";
  return (
    <Etiqueta
      {...(onAbrir
        ? {
            type: "button" as const,
            "aria-label": `Bloqueo: ${bloqueo.motivo}, ${rango}`,
          }
        : {})}
      data-bloqueo={bloqueo.id}
      className="rayas-bloqueo absolute z-[1] overflow-hidden rounded-[4px] px-1 py-px text-left text-[12px] leading-[15px] text-[color:var(--bloqueo-texto)]"
      style={estiloCaja(caja)}
      title={`${bloqueo.motivo} · ${rango}`}
      onClick={(e) => {
        e.stopPropagation();
        onAbrir?.(bloqueo.id);
      }}
    >
      <span className="block truncate font-medium">{bloqueo.motivo}</span>{" "}
      {caja.alto >= 30 ? (
        <span className="cifras block truncate">{rango}</span>
      ) : null}
    </Etiqueta>
  );
}

/** Colores de las clases en la agenda (naranja, aparte de los estados de las citas). */
export const COLOR_CLASE = {
  fondo: "var(--clase-fondo)",
  borde: "var(--clase-borde)",
  texto: "var(--clase-texto)",
};

/** Bloque de una clase: nombre, ocupación (5/8) y hora; abre la lista de inscritos. */
export function BloqueClase({
  clase,
  caja,
  nombreProfesional,
  onAbrir,
}: {
  clase: ClaseAgenda;
  caja: Caja;
  nombreProfesional?: string;
  onAbrir: (id: string, el: HTMLElement) => void;
}) {
  const llena = clase.inscritos >= clase.cupo;
  const etiqueta = [
    `Clase ${clase.servicioNombre}`,
    `${clase.inscritos} de ${clase.cupo} inscritos`,
    `${clase.horaInicio} a ${clase.horaFin}`,
    nombreProfesional ? `con ${nombreProfesional}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <button
      type="button"
      data-clase={clase.id}
      aria-label={etiqueta}
      title={etiqueta}
      onClick={(e) => {
        e.stopPropagation();
        onAbrir(clase.id, e.currentTarget);
      }}
      className="absolute z-[2] select-none overflow-hidden rounded-[4px] border-l-[3px] px-1 py-px text-left text-[12px] leading-[15px] shadow-[0_0_0_1px_hsl(var(--ac-papel))] hover:z-[5] hover:shadow-flota focus-visible:z-[5]"
      style={{
        ...estiloCaja(caja),
        background: COLOR_CLASE.fondo,
        borderLeftColor: COLOR_CLASE.borde,
        color: COLOR_CLASE.texto,
      }}
    >
      <span className="flex min-w-0 items-center gap-1 font-semibold">
        <Users className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{clase.servicioNombre}</span>
      </span>{" "}
      {caja.alto >= 30 ? (
        <span className="cifras block truncate">
          {llena ? "Llena" : `${clase.inscritos}/${clase.cupo} inscritos`}
        </span>
      ) : null}
      {caja.alto >= 46 ? (
        <span className="cifras block truncate opacity-80">
          {clase.horaInicio} – {clase.horaFin}
        </span>
      ) : null}
    </button>
  );
}

/** Foto o iniciales del profesional sobre su color. */
export function AvatarProfesional({
  profesional,
  tamano = 28,
}: {
  profesional: Pick<ProfesionalAgenda, "nombre" | "color" | "fotoUrl">;
  tamano?: number;
}) {
  if (profesional.fotoUrl) {
    return (
      <Image
        src={profesional.fotoUrl}
        alt=""
        width={tamano}
        height={tamano}
        className="shrink-0 rounded-full object-cover"
        style={{ width: tamano, height: tamano }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: tamano,
        height: tamano,
        background: profesional.color,
        fontSize: tamano * 0.4,
      }}
    >
      {iniciales(profesional.nombre)}
    </span>
  );
}
