"use client";

import { CalendarDays, ChevronLeft, Copy, Globe, List } from "lucide-react";
import { toast } from "sonner";
import { useMiembro } from "@/features/auth/components/proveedor-miembro";
import { cn } from "@/shared/lib/utils";
import { Checkbox } from "@/shared/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  ESTADOS,
  ESTADOS_ACTIVOS,
  ORDEN_ESTADOS,
  type EstadoCita,
} from "../lib/estados";
import { TODOS, useAgendaStore } from "../store/agenda";
import type { LocalAgenda, ProfesionalAgenda } from "../types";
import { MiniCalendario } from "./mini-calendario";
import { AvatarProfesional } from "./piezas";

export function etiquetaEstados(estados: EstadoCita[]): string {
  if (estados.length === ORDEN_ESTADOS.length) return "Todas las reservas";
  if (
    estados.length === ESTADOS_ACTIVOS.length &&
    !estados.includes("cancelado")
  )
    return "Reservas activas";
  if (estados.length === 1) return ESTADOS[estados[0]].nombre;
  return `${estados.length} estados`;
}

/** Panel izquierdo de la agenda: vista, enlace, profesional, estado y dos meses. */
export function PanelFiltros({
  locales,
  local,
  hayRecursos,
  profesionales,
  profesional,
  profesionalFijo,
  ancla,
  hoy,
  desde,
  hasta,
  onAncla,
  onPlegar,
  busqueda,
}: {
  locales: LocalAgenda[];
  local: LocalAgenda | null;
  /** El local tiene recursos: en la vista día se puede ver por recursos. */
  hayRecursos: boolean;
  profesionales: ProfesionalAgenda[];
  profesional: ProfesionalAgenda | null;
  profesionalFijo: string | null;
  ancla: string;
  hoy: string;
  desde: string;
  hasta: string;
  onAncla: (fecha: string) => void;
  onPlegar?: () => void;
  /** «Búsqueda rápida de hora» (solo para quien agenda). */
  busqueda?: React.ReactNode;
}) {
  const { vista, estados, porRecursos, poner } = useAgendaStore();
  const { negocioSlug, rol } = useMiembro();
  const elegido = profesional;
  const enLista = vista === "lista";

  async function copiar() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/reservar/${negocioSlug}`,
      );
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-center justify-between">
        <div
          className="inline-flex rounded-lg bg-ac-niebla p-1"
          role="group"
          aria-label="Forma de ver"
        >
          {[
            { lista: false, icono: CalendarDays, nombre: "Calendario" },
            { lista: true, icono: List, nombre: "Lista" },
          ].map(({ lista, icono: Icono, nombre }) => (
            <button
              key={nombre}
              type="button"
              aria-label={nombre}
              aria-pressed={enLista === lista}
              onClick={() => poner({ vista: lista ? "lista" : "semana" })}
              className="inline-flex h-11 w-12 md:h-9 items-center justify-center rounded-md text-ac-pizarra aria-pressed:bg-ac-papel aria-pressed:text-ac-tinta aria-pressed:shadow-quieta"
            >
              <Icono className="h-4 w-4" />
            </button>
          ))}
        </div>
        {onPlegar ? (
          <button
            type="button"
            onClick={onPlegar}
            aria-label="Plegar el panel"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ac-borde text-ac-pizarra hover:bg-ac-niebla"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {rol !== "profesional" ? (
        <div className="rounded-lg border border-ac-borde bg-ac-laguna-claro/60 p-3 text-center">
          <Globe
            className="mx-auto h-6 w-6 text-ac-laguna"
            aria-hidden="true"
          />
          <p className="mt-1.5 font-semibold">
            Comparte tu enlace y recibe reservas
          </p>
          <div className="mt-2 flex items-center gap-1 rounded-md border border-ac-borde bg-ac-papel py-1 pl-2 pr-1">
            <span className="min-w-0 flex-1 truncate text-left text-[12px] text-ac-pizarra">
              /reservar/{negocioSlug}
            </span>
            <button
              type="button"
              onClick={copiar}
              aria-label="Copiar enlace de reservas"
              className="inline-flex h-11 w-11 md:h-7 md:w-7 items-center justify-center rounded border border-ac-borde hover:bg-ac-niebla"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {busqueda}

      {locales.length > 1 && !profesionalFijo ? (
        <div className="space-y-1.5">
          <span className="font-semibold" id="filtro-local">
            Local
          </span>
          <Select
            value={local?.id ?? ""}
            onValueChange={(v) => poner({ localId: v, profesionalId: null })}
          >
            <SelectTrigger
              aria-labelledby="filtro-local"
              className="md:h-10 bg-ac-papel"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {locales.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-semibold" id="filtro-profesional">
            Profesional
          </span>
          {elegido ? (
            <AvatarProfesional profesional={elegido} tamano={24} />
          ) : null}
        </div>
        <Select
          value={profesional?.id ?? TODOS}
          onValueChange={(v) => poner({ profesionalId: v })}
          disabled={Boolean(profesionalFijo)}
        >
          <SelectTrigger
            aria-labelledby="filtro-profesional"
            className="md:h-10 bg-ac-papel"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los profesionales</SelectItem>
            {profesionales.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {vista === "dia" && hayRecursos && !profesionalFijo ? (
        <div className="space-y-1.5">
          <span className="font-semibold" id="filtro-columnas">
            Columnas
          </span>
          <div
            className="grid grid-cols-2 rounded-lg bg-ac-niebla p-1"
            role="group"
            aria-labelledby="filtro-columnas"
          >
            {[false, true].map((r) => (
              <button
                key={String(r)}
                type="button"
                aria-pressed={porRecursos === r}
                onClick={() => poner({ porRecursos: r })}
                className="h-11 md:h-8 rounded-md text-[13px] font-medium text-ac-pizarra aria-pressed:bg-ac-papel aria-pressed:text-ac-tinta aria-pressed:shadow-quieta"
              >
                {r ? "Recursos" : "Profesionales"}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <FiltroEstado estados={estados} onCambio={(e) => poner({ estados: e })} />

      <MiniCalendario
        ancla={ancla}
        hoy={hoy}
        desde={desde}
        hasta={hasta}
        onElegir={onAncla}
      />
    </div>
  );
}

function FiltroEstado({
  estados,
  onCambio,
}: {
  estados: EstadoCita[];
  onCambio: (e: EstadoCita[]) => void;
}) {
  const alternar = (e: EstadoCita) =>
    onCambio(
      estados.includes(e)
        ? estados.filter((x) => x !== e)
        : ORDEN_ESTADOS.filter((x) => x === e || estados.includes(x)),
    );
  return (
    <div className="space-y-1.5">
      <span className="font-semibold">Estado de la reserva</span>
      <Popover>
        <PopoverTrigger className="flex h-11 w-full md:h-10 items-center justify-between rounded-md border border-ac-borde bg-ac-papel px-3 text-left">
          {etiquetaEstados(estados)}
          <span aria-hidden="true" className="text-ac-neblina">
            ▾
          </span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2">
          <div className="mb-1 flex gap-1">
            {[
              { nombre: "Activas", lista: ESTADOS_ACTIVOS },
              { nombre: "Todas", lista: ORDEN_ESTADOS },
            ].map((o) => (
              <button
                key={o.nombre}
                type="button"
                onClick={() => onCambio(o.lista)}
                className="min-h-11 flex-1 rounded-md border border-ac-borde py-1 text-[13px] hover:bg-ac-niebla md:min-h-0"
              >
                {o.nombre}
              </button>
            ))}
          </div>
          {ORDEN_ESTADOS.map((e) => (
            <label
              key={e}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-ac-niebla md:min-h-0",
              )}
            >
              <Checkbox
                checked={estados.includes(e)}
                onCheckedChange={() => alternar(e)}
                disabled={estados.length === 1 && estados.includes(e)}
              />
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: ESTADOS[e].borde }}
                aria-hidden="true"
              />
              {ESTADOS[e].nombre}
            </label>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
