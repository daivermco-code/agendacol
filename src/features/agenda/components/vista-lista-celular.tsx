"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronUp, Clock, Users } from "lucide-react";
import type { DiaHorario } from "@/features/administracion/schemas";
import { useClases } from "@/features/clases/store/clases";
import { cn } from "@/shared/lib/utils";
import { ESTADOS } from "../lib/estados";
import { aHora, diaSemana } from "../lib/fechas";
import { abiertosDelDia } from "../lib/horario";
import type { CitaAgenda, ClaseAgenda, ProfesionalAgenda } from "../types";
import { COLOR_CLASE } from "./piezas";

interface Props {
  dias: string[];
  hoy: string;
  citas: CitaAgenda[];
  clases: ClaseAgenda[];
  profesionales: ProfesionalAgenda[];
  /** Profesional elegido (o el del rol Profesional); null = todo el local. */
  profesional: ProfesionalAgenda | null;
  /** El rol Profesional ve "Trabajas hoy"; los demás, de quién es el horario. */
  esPropio: boolean;
  horarioLocal: DiaHorario[];
  onCita?: (cita: CitaAgenda, el: HTMLElement) => void;
  onAnteriores: () => void;
}

const mayus = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const plural = (n: number, una: string, varias: string) =>
  n === 0 ? "Sin citas" : `${n} ${n === 1 ? una : varias}`;

/** "09:00–13:00 y 14:00–18:00", o null si ese día no se atiende. */
function textoHorario(horario: DiaHorario[], fecha: string): string | null {
  const tramos = abiertosDelDia(
    horario.find((d) => d.dia === diaSemana(fecha)),
  );
  if (tramos.length === 0) return null;
  return tramos.map((t) => `${aHora(t.inicio)}–${aHora(t.fin)}`).join(" y ");
}

/**
 * Lista del celular (T-12.6): cada día con su placa (día abreviado y número), "N citas" y las citas como
 * tarjetas anchas del color de su estado. Hoy lleva además el horario de trabajo.
 */
export function VistaListaCelular(p: Props) {
  const abrirClase = useClases((e) => e.abrir);
  const caja = useRef<HTMLDivElement>(null);
  const llevada = useRef<string | null>(null);
  // Abre en hoy: lo de antes queda arriba. Se lleva una vez por semana y otra cuando llegan
  // las citas (los días de antes crecen y empujarían a hoy hacia abajo); el refresco de cada minuto no la mueve.
  const llave = `${p.dias[0]}|${p.citas.length > 0 ? "datos" : "vacia"}`;
  useLayoutEffect(() => {
    if (llevada.current === llave || !p.dias.includes(p.hoy)) return;
    llevada.current = llave;
    const c = caja.current;
    const hoy = c?.querySelector<HTMLElement>("[data-hoy]");
    if (!c || !hoy) return;
    c.scrollTop +=
      hoy.getBoundingClientRect().top - c.getBoundingClientRect().top - 12;
  }, [llave, p.dias, p.hoy]);
  const porDia = useMemo(
    () =>
      p.dias.map((fecha) => ({
        fecha,
        citas: p.citas
          .filter((c) => c.fecha === fecha)
          .sort((a, b) => a.inicio - b.inicio),
        clases: p.clases
          .filter((k) => k.fecha === fecha)
          .sort((a, b) => a.inicio - b.inicio),
      })),
    [p.dias, p.citas, p.clases],
  );
  const nombres = useMemo(
    () => new Map(p.profesionales.map((x) => [x.id, x.nombre])),
    [p.profesionales],
  );
  const horarioHoy = p.profesional
    ? textoHorario(p.profesional.horario, p.hoy)
    : textoHorario(p.horarioLocal, p.hoy);
  const quien = p.esPropio
    ? "Trabajas hoy"
    : p.profesional
      ? `${p.profesional.nombre.split(" ")[0]} trabaja hoy`
      : "El local atiende hoy";

  return (
    <div ref={caja} className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3">
      <button
        type="button"
        onClick={p.onAnteriores}
        className="mx-auto flex h-11 items-center gap-1 rounded-full px-4 text-[14px] font-semibold text-ac-laguna hover:bg-ac-laguna-claro"
      >
        <ChevronUp className="h-4 w-4" aria-hidden="true" />
        Días anteriores
      </button>
      <ol className="mt-2 space-y-5">
        {porDia.map(({ fecha, citas, clases }) => {
          const esHoy = fecha === p.hoy;
          const d = parseISO(fecha);
          const total = citas.length;
          return (
            <li
              key={fecha}
              data-hoy={esHoy ? "" : undefined}
              aria-label={mayus(format(d, "EEEE d 'de' MMMM", { locale: es }))}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl leading-none",
                    esHoy
                      ? "bg-ac-laguna text-ac-papel"
                      : "bg-ac-papel text-ac-tinta ring-1 ring-ac-borde",
                  )}
                  aria-hidden="true"
                >
                  <span className="text-[11px] font-semibold uppercase">
                    {format(d, "EEE", { locale: es }).replace(".", "")}
                  </span>
                  <span className="cifras text-[18px] font-bold">
                    {format(d, "d")}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">
                    {esHoy
                      ? "Hoy"
                      : mayus(format(d, "EEEE d 'de' MMMM", { locale: es }))}
                  </span>
                  <span className="block text-[13px] text-ac-pizarra">
                    {plural(total, "cita", "citas")}
                    {clases.length > 0
                      ? ` · ${clases.length} ${clases.length === 1 ? "clase" : "clases"}`
                      : ""}
                  </span>
                </span>
              </div>

              {esHoy && horarioHoy ? (
                <p className="mt-2 flex items-center gap-2 rounded-2xl border border-ac-borde bg-ac-papel px-4 py-3 text-[14px]">
                  <Clock
                    className="h-4 w-4 shrink-0 text-ac-laguna"
                    aria-hidden="true"
                  />
                  <span>
                    {quien}{" "}
                    <span className="cifras font-semibold">{horarioHoy}</span>
                  </span>
                </p>
              ) : null}

              {total + clases.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {clases.map((k) => (
                    <li key={k.id}>
                      <button
                        type="button"
                        onClick={(e) => abrirClase(k.id, e.currentTarget)}
                        className="flex w-full flex-col rounded-2xl border-l-4 px-4 py-3 text-left"
                        style={{
                          background: COLOR_CLASE.fondo,
                          borderLeftColor: COLOR_CLASE.borde,
                          color: COLOR_CLASE.texto,
                        }}
                      >
                        <span className="cifras text-[13px]">
                          {aHora(k.inicio)} – {aHora(k.fin)}
                        </span>
                        <span className="flex items-center gap-1 text-[15px] font-semibold">
                          <Users className="h-4 w-4" aria-hidden="true" />
                          {k.servicioNombre}
                        </span>
                        <span className="text-[13px]">
                          {k.inscritos}/{k.cupo} inscritos ·{" "}
                          {nombres.get(k.profesionalId) ?? ""}
                        </span>
                      </button>
                    </li>
                  ))}
                  {citas.map((c) => {
                    const color = ESTADOS[c.estado];
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          aria-label={`Ver la cita de ${c.clienteNombre}, ${c.servicioNombre}, ${aHora(c.inicio)}, ${color.nombre}`}
                          onClick={(e) => p.onCita?.(c, e.currentTarget)}
                          className="flex w-full flex-col rounded-2xl border-l-4 px-4 py-3 text-left"
                          style={{
                            background: color.fondo,
                            borderLeftColor: color.borde,
                            color: color.texto,
                          }}
                        >
                          <span className="flex items-center justify-between gap-2 text-[13px]">
                            <span className="cifras">
                              {aHora(c.inicio)} – {aHora(c.fin)}
                            </span>
                            <span className="font-semibold">
                              {color.nombre}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "truncate text-[15px] font-semibold",
                              c.estado === "cancelado" && "line-through",
                            )}
                          >
                            {c.clienteNombre}
                          </span>
                          <span className="truncate text-[13px]">
                            {c.servicioNombre}
                            {p.profesional
                              ? ""
                              : ` · ${nombres.get(c.profesionalId) ?? ""}`}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
