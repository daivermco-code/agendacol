"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarX2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useClases } from "@/features/clases/store/clases";
import { Vacio } from "@/shared/components/vacio";
import { pesos } from "@/shared/lib/formato";
import { Button } from "@/shared/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/accordion";
import { ESTADOS } from "../lib/estados";
import type { CitaAgenda, ClaseAgenda, ProfesionalAgenda } from "../types";
import { COLOR_CLASE } from "./piezas";

interface Props {
  dias: string[];
  citas: CitaAgenda[];
  clases: ClaseAgenda[];
  profesionales: ProfesionalAgenda[];
  agrupada: boolean;
  puedeAgendar: boolean;
  onAgrupada: (agrupada: boolean) => void;
  onNueva: () => void;
  onCita?: (cita: CitaAgenda, el: HTMLElement) => void;
  onEditar?: (cita: CitaAgenda) => void;
  onEliminar?: (cita: CitaAgenda) => void;
}

type Fila =
  | { tipo: "cita"; inicio: number; cita: CitaAgenda }
  | { tipo: "clase"; inicio: number; clase: ClaseAgenda };

const nombreDia = (fecha: string) => {
  const t = format(parseISO(fecha), "EEEE d 'de' MMMM", { locale: es });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const plural = (n: number, una: string, varias: string) =>
  `${n} ${n === 1 ? una : varias}`;

/** Lista de citas y clases: acordeones por día o una sola lista. */
export function VistaLista(p: Props) {
  const porDia = useMemo(
    () =>
      p.dias
        .map((fecha) => {
          const citas = p.citas.filter((c) => c.fecha === fecha);
          const clases = p.clases.filter((k) => k.fecha === fecha);
          const filas: Fila[] = [
            ...citas.map((cita) => ({
              tipo: "cita" as const,
              inicio: cita.inicio,
              cita,
            })),
            ...clases.map((clase) => ({
              tipo: "clase" as const,
              inicio: clase.inicio,
              clase,
            })),
          ].sort((a, b) => a.inicio - b.inicio);
          return { fecha, filas, citas: citas.length, clases: clases.length };
        })
        .filter((d) => d.filas.length > 0),
    [p.dias, p.citas, p.clases],
  );
  const nombres = new Map(p.profesionales.map((x) => [x.id, x.nombre]));
  const acciones = {
    onCita: p.onCita,
    onEditar: p.puedeAgendar ? p.onEditar : undefined,
    onEliminar: p.puedeAgendar ? p.onEliminar : undefined,
  };

  return (
    <div className="min-h-0 flex-1 overflow-auto px-3 py-3 md:px-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div
          className="inline-flex rounded-md border border-ac-borde bg-ac-papel p-0.5"
          role="group"
          aria-label="Agrupar"
        >
          {[true, false].map((g) => (
            <button
              key={String(g)}
              type="button"
              aria-pressed={p.agrupada === g}
              onClick={() => p.onAgrupada(g)}
              className="rounded px-3 py-1 text-[13px] font-medium min-h-11 md:min-h-0 aria-pressed:bg-ac-laguna-claro aria-pressed:text-ac-laguna-hondo"
            >
              {g ? "Agrupada por día" : "Desagrupada"}
            </button>
          ))}
        </div>
        {p.puedeAgendar ? (
          <Button size="sm" onClick={p.onNueva}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Nueva reserva
          </Button>
        ) : null}
      </div>
      {porDia.length === 0 ? (
        <Vacio
          icono={CalendarX2}
          titulo="No hay reservas en este período"
          texto="Cambia de semana o quita filtros para ver más citas."
        />
      ) : p.agrupada ? (
        <Accordion
          type="multiple"
          defaultValue={porDia.map((d) => d.fecha)}
          className="space-y-2"
        >
          {porDia.map((d) => (
            <AccordionItem
              key={d.fecha}
              value={d.fecha}
              className="rounded-lg border border-ac-borde bg-ac-papel px-3"
            >
              <AccordionTrigger className="py-3 text-[14px] font-semibold">
                <span>
                  {nombreDia(d.fecha)}{" "}
                  <span className="font-normal text-ac-pizarra">
                    · {plural(d.citas, "reserva", "reservas")}
                    {d.clases
                      ? ` · ${plural(d.clases, "clase", "clases")}`
                      : ""}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <Filas filas={d.filas} nombres={nombres} {...acciones} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <div className="rounded-lg border border-ac-borde bg-ac-papel px-3">
          <Filas
            filas={porDia.flatMap((d) => d.filas)}
            nombres={nombres}
            conFecha
            {...acciones}
          />
        </div>
      )}
    </div>
  );
}

const fechaCorta = (fecha: string) => `${fecha.slice(8)}/${fecha.slice(5, 7)} `;

function FilaClase({
  clase: k,
  nombre,
  conFecha,
  conAcciones,
}: {
  clase: ClaseAgenda;
  nombre?: string;
  conFecha?: boolean;
  conAcciones: boolean;
}) {
  const abrir = useClases((e) => e.abrir);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-0 py-1 text-[13px] md:flex-nowrap md:gap-y-1 md:py-2.5">
      <span className="cifras w-[112px] shrink-0 font-semibold">
        {conFecha ? fechaCorta(k.fecha) : ""}
        {k.horaInicio} – {k.horaFin}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <Users
          className="h-3.5 w-3.5 shrink-0"
          style={{ color: COLOR_CLASE.borde }}
          aria-hidden="true"
        />
        <span className="truncate">{k.servicioNombre}</span>
      </span>
      <span className="hidden w-36 truncate text-ac-pizarra lg:block">
        {nombre}
      </span>
      <button
        type="button"
        className="cifras w-40 truncate text-left font-medium hover:underline min-h-11 md:min-h-0"
        aria-label={`Ver la clase ${k.servicioNombre} de las ${k.horaInicio}`}
        onClick={(ev) => abrir(k.id, ev.currentTarget)}
      >
        {k.inscritos >= k.cupo
          ? `Llena (${k.cupo})`
          : `${k.inscritos} de ${k.cupo} inscritos`}
      </button>
      <span className="cifras hidden w-24 text-right text-ac-pizarra md:block">
        {pesos(k.precio)}
      </span>
      <span className="flex w-28 items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: COLOR_CLASE.borde }}
          aria-hidden="true"
        />
        Clase
      </span>
      {conAcciones ? (
        <span className="hidden w-[68px] md:block" aria-hidden="true" />
      ) : null}
    </li>
  );
}

function Filas({
  filas,
  nombres,
  conFecha,
  onCita,
  onEditar,
  onEliminar,
}: {
  filas: Fila[];
  nombres: Map<string, string>;
  conFecha?: boolean;
} & Pick<Props, "onCita" | "onEditar" | "onEliminar">) {
  return (
    <ul className="divide-y divide-ac-borde">
      {filas.map((f) => {
        if (f.tipo === "clase")
          return (
            <FilaClase
              key={`k:${f.clase.id}`}
              clase={f.clase}
              nombre={nombres.get(f.clase.profesionalId)}
              conFecha={conFecha}
              conAcciones={Boolean(onEditar && onEliminar)}
            />
          );
        const c = f.cita;
        const e = ESTADOS[c.estado];
        return (
          <li
            key={c.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-0 py-1 text-[13px] md:flex-nowrap md:gap-y-1 md:py-2.5"
          >
            <span className="cifras w-[112px] shrink-0 font-semibold">
              {conFecha ? fechaCorta(c.fecha) : ""}
              {c.horaInicio} – {c.horaFin}
            </span>
            <span className="min-w-0 flex-1 truncate">{c.servicioNombre}</span>
            <span className="hidden w-36 truncate text-ac-pizarra lg:block">
              {nombres.get(c.profesionalId)}
            </span>
            <button
              type="button"
              className="w-40 truncate text-left font-medium hover:underline min-h-11 md:min-h-0"
              aria-label={`Ver la cita de ${c.clienteNombre}`}
              onClick={(ev) => onCita?.(c, ev.currentTarget)}
            >
              {c.clienteNombre}
            </button>
            <span className="cifras hidden w-24 text-right text-ac-pizarra md:block">
              {pesos(c.precio)}
            </span>
            <span className="flex w-28 items-center gap-1.5" title={e.nombre}>
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: e.borde }}
                aria-hidden="true"
              />
              {e.nombre}
            </span>
            {onEditar && onEliminar ? (
              <span className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:h-8 md:w-8"
                  aria-label={`Editar la cita de ${c.clienteNombre}`}
                  onClick={() => onEditar(c)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:h-8 md:w-8"
                  aria-label={`Eliminar la cita de ${c.clienteNombre}`}
                  onClick={() => onEliminar(c)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
