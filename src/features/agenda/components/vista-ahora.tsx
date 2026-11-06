"use client";

import { useMemo, type ReactNode } from "react";
import { CalendarPlus } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useAgenda } from "../hooks/use-agenda";
import {
  clasificarAhora,
  horaReservaRapida,
  type Atendiendo,
  type Libre,
  type NoDisponible,
  type Ocupacion,
} from "../lib/ahora";
import { aHora } from "../lib/fechas";
import type { PedidoNuevo, ProfesionalAgenda } from "../types";
import { AvatarProfesional } from "./piezas";

interface Props {
  localId: string;
  profesionales: ProfesionalAgenda[];
  ahora: { fecha: string; minutos: number };
  puedeReservar: boolean;
  onNuevo: (pedido: PedidoNuevo) => void;
}

/** "25 min", "1 h" o "1 h 20 min". */
function duracion(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const conQuien = (o: Ocupacion) =>
  o.tipo === "clase"
    ? `Clase de ${o.quien} · ${o.servicio}`
    : `Con ${o.quien} · ${o.servicio}`;

function textoNoDisponible(n: NoDisponible): string {
  const motivo = textoMotivo(n);
  return n.proxima === null
    ? motivo
    : `${motivo} · cita a las ${aHora(n.proxima)}`;
}

function textoMotivo(n: NoDisponible): string {
  const vuelve = n.vuelve === null ? null : aHora(n.vuelve);
  switch (n.motivo) {
    case "dia_libre":
      return "Tiene el día libre";
    case "antes":
      return vuelve ? `Empieza a las ${vuelve}` : "Hoy no atiende";
    case "descanso":
      return vuelve
        ? `En descanso, vuelve a las ${vuelve}`
        : "En descanso el resto del día";
    case "termino":
      return "Terminó por hoy";
    case "bloqueo":
      return vuelve
        ? `${n.detalle || "Bloqueado"} · vuelve a las ${vuelve}`
        : `${n.detalle || "Bloqueado"} · el resto del día`;
  }
}

/**
 * Vista "Ahora" del celular (T-12.8): quién atiende, quién está libre y quién no está, en este minuto. Usa la
 * agenda de hoy sin filtros (comparte la caché con la vista Día) y se actualiza con el reloj de la agenda.
 */
export function VistaAhora(p: Props) {
  const consulta = useAgenda(p.localId, "dia", p.ahora.fecha);
  const datos = consulta.data;
  const r = useMemo(
    () =>
      clasificarAhora({
        profesionales: p.profesionales,
        citas: datos?.citas ?? [],
        clases: datos?.clases ?? [],
        bloqueos: datos?.bloqueos ?? [],
        fecha: p.ahora.fecha,
        minutos: p.ahora.minutos,
      }),
    [p.profesionales, datos, p.ahora],
  );

  // Mientras llega el día nuevo (a medianoche), React Query muestra el anterior: no sirve para "ahora".
  if (!datos || consulta.isPlaceholderData) {
    if (consulta.isError) {
      return (
        <div className="space-y-3 p-6 text-center" role="alert">
          <p className="text-[14px] text-ac-pizarra">
            No se pudo cargar la agenda de hoy.
          </p>
          <button
            type="button"
            onClick={() => void consulta.refetch()}
            className="h-11 rounded-full border border-ac-borde bg-ac-papel px-4 text-[14px] font-semibold"
          >
            Reintentar
          </button>
        </div>
      );
    }
    return (
      <p className="p-6 text-center text-[14px] text-ac-pizarra" role="status">
        Cargando el equipo…
      </p>
    );
  }

  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-6 pt-3">
      <p className="cifras text-[13px] text-ac-pizarra">
        Hoy a las {aHora(p.ahora.minutos)} · se actualiza solo
      </p>
      <Seccion titulo="Atendiendo" total={r.atendiendo.length}>
        {r.atendiendo.map((x) => (
          <FilaAtendiendo key={x.profesional.id} x={x} />
        ))}
      </Seccion>
      <Seccion titulo="Libres" total={r.libres.length}>
        {r.libres.map((x) => (
          <FilaLibre
            key={x.profesional.id}
            x={x}
            puedeReservar={p.puedeReservar}
            onReservar={() =>
              p.onNuevo({
                tipo: "reserva",
                fecha: p.ahora.fecha,
                minuto: horaReservaRapida(p.ahora.minutos, x.hasta),
                profesionalId: x.profesional.id,
              })
            }
          />
        ))}
      </Seccion>
      <Seccion titulo="No disponibles" total={r.noDisponibles.length}>
        {r.noDisponibles.map((x) => (
          <Tarjeta key={x.profesional.id} profesional={x.profesional} apagada>
            <span className="block text-[13px] text-ac-pizarra">
              {textoNoDisponible(x)}
            </span>
          </Tarjeta>
        ))}
      </Seccion>
    </div>
  );
}

function Seccion({
  titulo,
  total,
  children,
}: {
  titulo: string;
  total: number;
  children: ReactNode;
}) {
  if (total === 0) return null;
  return (
    <section aria-label={titulo}>
      <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-ac-pizarra">
        {titulo}
        <span className="cifras rounded-full bg-ac-niebla px-2 text-[12px]">
          {total}
        </span>
      </h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

function Tarjeta({
  profesional,
  apagada,
  derecha,
  children,
}: {
  profesional: ProfesionalAgenda;
  apagada?: boolean;
  derecha?: ReactNode;
  children: ReactNode;
}) {
  return (
    <li
      aria-label={profesional.nombre}
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-ac-borde bg-ac-papel px-3 py-3",
        apagada && "bg-ac-niebla",
      )}
    >
      <span className={cn(apagada && "opacity-60")}>
        <AvatarProfesional profesional={profesional} tamano={40} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">
          {profesional.nombre}
        </span>
        {children}
      </span>
      {derecha}
    </li>
  );
}

function FilaAtendiendo({ x }: { x: Atendiendo }) {
  return (
    <Tarjeta
      profesional={x.profesional}
      derecha={
        <span
          className={cn(
            "cifras shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold",
            x.terminando
              ? "bg-ac-aviso/10 text-ac-aviso"
              : "bg-ac-laguna-claro text-ac-laguna-hondo",
          )}
        >
          {x.terminando ? "Terminando" : `Quedan ${duracion(x.quedan)}`}
        </span>
      }
    >
      <span className="block truncate text-[13px]">
        {conQuien(x.actual)}
        {x.ademas > 0 && ` · y ${x.ademas} más`}
      </span>
      <span className="cifras block truncate text-[12px] text-ac-pizarra">
        {x.siguiente
          ? `Sigue a las ${aHora(x.siguiente.inicio)} · ${x.siguiente.quien}`
          : "Sin más citas hoy"}
      </span>
    </Tarjeta>
  );
}

function FilaLibre({
  x,
  puedeReservar,
  onReservar,
}: {
  x: Libre;
  puedeReservar: boolean;
  onReservar: () => void;
}) {
  return (
    <Tarjeta
      profesional={x.profesional}
      derecha={
        puedeReservar ? (
          <button
            type="button"
            aria-label={`Reserva rápida con ${x.profesional.nombre}`}
            onClick={onReservar}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-ac-laguna px-3.5 text-[13px] font-semibold text-ac-papel hover:bg-ac-laguna-hondo"
          >
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            Reservar
          </button>
        ) : null
      }
    >
      <span className="cifras block text-[13px] text-ac-exito">
        {x.hasta === null
          ? "Libre el resto del día"
          : `Libre hasta las ${aHora(x.hasta)}`}
      </span>
    </Tarjeta>
  );
}

/** Interruptor Día / Ahora de la vista Día del celular (Dueño, con 2 o más profesionales). */
export function InterruptorAhora({
  modo,
  onModo,
}: {
  modo: "dia" | "ahora";
  onModo: (modo: "dia" | "ahora") => void;
}) {
  return (
    <div className="border-b border-ac-borde bg-ac-papel px-4 py-2">
      <div
        role="group"
        aria-label="Día o Ahora"
        className="flex rounded-full bg-ac-niebla p-1"
      >
        {(
          [
            ["dia", "Día"],
            ["ahora", "Ahora"],
          ] as const
        ).map(([valor, nombre]) => (
          <button
            key={valor}
            type="button"
            aria-pressed={modo === valor}
            onClick={() => onModo(valor)}
            className={cn(
              "h-11 flex-1 rounded-full text-[14px] font-semibold text-ac-pizarra",
              modo === valor && "bg-ac-papel text-ac-tinta shadow-sm",
            )}
          >
            {nombre}
          </button>
        ))}
      </div>
    </div>
  );
}
