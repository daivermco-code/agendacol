"use client";

import {
  Ban,
  CalendarPlus,
  CircleDollarSign,
  Info,
  Users,
  WifiOff,
} from "lucide-react";
import { BLOQUES } from "@/features/ajustes/schemas";
import { usePanelVenta } from "@/features/ventas/store/panel-venta";
import { cn } from "@/shared/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { ESTADOS, ORDEN_ESTADOS } from "../lib/estados";
import type { Vista } from "../lib/fechas";
import type { PedidoNuevo } from "../types";

export const VISTAS: { valor: Vista; nombre: string }[] = [
  { valor: "dia", nombre: "Día" },
  { valor: "semana", nombre: "Semana" },
  { valor: "mes", nombre: "Mes" },
  { valor: "lista", nombre: "Lista" },
];

/** En el celular: Lista, Día, 3 días, Semana y Mes (T-12.5). */
export const VISTAS_CELULAR: { valor: Vista; nombre: string }[] = [
  { valor: "lista", nombre: "Lista" },
  { valor: "dia", nombre: "Día" },
  { valor: "3dias", nombre: "3 días" },
  { valor: "semana", nombre: "Semana" },
  { valor: "mes", nombre: "Mes" },
];

export const REDONDO =
  "inline-flex h-11 w-11 md:h-9 md:w-9 shrink-0 items-center justify-center rounded-full border border-ac-borde bg-ac-papel text-ac-pizarra hover:bg-ac-niebla disabled:opacity-50";

export interface ControlesAgenda {
  vista: Vista;
  onVista: (v: Vista) => void;
  onMover: (paso: 1 | -1) => void;
  onHoy: () => void;
  titulo: string;
  subtitulo: string;
  hace: number;
  enVivo: boolean;
  recargando: boolean;
  onRecargar: () => void;
  bloque: number;
  onBloque: (b: number) => void;
  permisos: { reserva: boolean; bloqueo: boolean; venta: boolean };
  onNuevo: (p: PedidoNuevo) => void;
}

export function SelectorVista({
  vista,
  onVista,
  className,
}: {
  vista: Vista;
  onVista: (v: Vista) => void;
  className?: string;
}) {
  return (
    <Select value={vista} onValueChange={(v) => onVista(v as Vista)}>
      <SelectTrigger
        aria-label="Vista"
        className={cn(
          "md:h-9 w-[104px] rounded-full bg-ac-papel font-semibold",
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {VISTAS.map((v) => (
          <SelectItem key={v.valor} value={v.valor}>
            {v.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SelectorBloque({
  bloque,
  onBloque,
}: {
  bloque: number;
  onBloque: (b: number) => void;
}) {
  return (
    <Select value={String(bloque)} onValueChange={(v) => onBloque(Number(v))}>
      <SelectTrigger
        aria-label="Largo del bloque"
        className="md:h-9 w-[92px] rounded-full bg-ac-papel"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {BLOQUES.map((b) => (
          <SelectItem key={b} value={String(b)}>
            {b} min
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function Leyenda() {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Leyenda de colores"
        className="inline-flex h-11 w-11 md:h-9 md:w-9 items-center justify-center rounded-full text-ac-pizarra hover:bg-ac-niebla"
      >
        <Info className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-3">
        <p className="mb-2 font-semibold">Estados de la reserva</p>
        <ul className="space-y-1.5">
          {ORDEN_ESTADOS.map((e) => (
            <li key={e} className="flex items-center gap-2 text-[13px]">
              <span
                className="h-4 w-6 rounded-[3px] border-l-[3px]"
                style={{
                  background: ESTADOS[e].fondo,
                  borderLeftColor: ESTADOS[e].borde,
                }}
              />
              {ESTADOS[e].nombre}
            </li>
          ))}
          <li className="flex items-center gap-2 text-[13px]">
            <span className="rayas-bloqueo h-4 w-6 rounded-[3px]" />
            Horario bloqueado
          </li>
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function MenuNuevo({
  permisos,
  onNuevo,
  children,
}: Pick<ControlesAgenda, "permisos" | "onNuevo"> & {
  children: React.ReactNode;
}) {
  const abrirVenta = usePanelVenta((s) => s.abrir);
  if (!permisos.reserva && !permisos.bloqueo && !permisos.venta) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {permisos.reserva ? (
          <DropdownMenuItem onSelect={() => onNuevo({ tipo: "reserva" })}>
            <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Reserva
          </DropdownMenuItem>
        ) : null}
        {permisos.reserva ? (
          <DropdownMenuItem onSelect={() => onNuevo({ tipo: "clase" })}>
            <Users className="h-4 w-4" aria-hidden="true" /> Clase
          </DropdownMenuItem>
        ) : null}
        {permisos.bloqueo ? (
          <DropdownMenuItem onSelect={() => onNuevo({ tipo: "bloqueo" })}>
            <Ban className="h-4 w-4" aria-hidden="true" /> Bloquear horario
          </DropdownMenuItem>
        ) : null}
        {permisos.venta ? (
          <DropdownMenuItem onSelect={() => abrirVenta({}, { tipo: "agenda" })}>
            <CircleDollarSign className="h-4 w-4" aria-hidden="true" /> Nueva
            venta
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Actualizado({
  hace,
  enVivo,
  className,
}: {
  hace: number;
  enVivo: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "items-center gap-1 text-[13px] text-ac-pizarra",
        className,
      )}
      aria-live="polite"
    >
      {enVivo ? null : (
        <span className="mr-1 inline-flex items-center gap-1 rounded-full bg-ac-demo-fondo px-2 py-0.5 text-[12px] font-medium text-ac-demo-texto">
          <WifiOff className="h-3 w-3" aria-hidden="true" /> Sin actualización
          en vivo
        </span>
      )}
      Actualizado hace {hace} min
    </span>
  );
}
