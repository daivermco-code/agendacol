"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Expand,
  PanelLeftOpen,
  Printer,
  RefreshCw,
  Store,
  WifiOff,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import {
  Actualizado,
  type ControlesAgenda,
  Leyenda,
  MenuNuevo,
  REDONDO,
  SelectorBloque,
  SelectorVista,
} from "./controles-agenda";

function Icono({
  etiqueta,
  children,
  ...props
}: React.ComponentProps<"button"> & { etiqueta: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={etiqueta}
          className={REDONDO}
          {...props}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{etiqueta}</TooltipContent>
    </Tooltip>
  );
}

/** Barra de la agenda en tableta y computador. */
export function BarraAgenda(
  c: ControlesAgenda & {
    plegado: boolean;
    onAbrirPanel: () => void;
    ajustar: boolean | null;
    onAjustar: () => void;
    onPantallaCompleta: () => void;
  },
) {
  return (
    <div className="flex items-center gap-2 border-b border-ac-borde bg-ac-papel px-3 py-2 print:border-0">
      <Icono
        etiqueta="Abrir filtros"
        onClick={c.onAbrirPanel}
        className={cn(REDONDO, "print:hidden", !c.plegado && "lg:hidden")}
      >
        <PanelLeftOpen className="h-4 w-4" />
      </Icono>
      <SelectorVista
        vista={c.vista}
        onVista={c.onVista}
        className="print:hidden"
      />
      <div className="flex items-center print:hidden">
        <Icono
          etiqueta="Anterior"
          onClick={() => c.onMover(-1)}
          className="inline-flex h-9 w-8 items-center justify-center rounded-full hover:bg-ac-niebla"
        >
          <ChevronLeft className="h-5 w-5" />
        </Icono>
        <Icono
          etiqueta="Siguiente"
          onClick={() => c.onMover(1)}
          className="inline-flex h-9 w-8 items-center justify-center rounded-full hover:bg-ac-niebla"
        >
          <ChevronRight className="h-5 w-5" />
        </Icono>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="md:h-9 rounded-full print:hidden"
        onClick={c.onHoy}
      >
        Hoy
      </Button>
      <div className="min-w-0 leading-tight">
        <p className="cifras truncate font-semibold">{c.titulo}</p>
        <p className="flex items-center gap-1 truncate text-[12px] text-ac-pizarra">
          <Store className="h-3 w-3 shrink-0" aria-hidden="true" />{" "}
          {c.subtitulo}
        </p>
      </div>
      <div className="ml-auto flex items-center gap-1.5 print:hidden">
        <Leyenda />
        <Actualizado
          hace={c.hace}
          enVivo={c.enVivo}
          className="hidden xl:inline-flex"
        />
        {c.enVivo ? null : (
          <WifiOff
            className="h-4 w-4 text-ac-aviso xl:hidden"
            aria-label="Sin actualización en vivo"
          />
        )}
        <Icono etiqueta="Recargar" onClick={c.onRecargar}>
          <RefreshCw
            className={cn("h-4 w-4", c.recargando && "animate-spin")}
          />
        </Icono>
        {c.ajustar !== null ? (
          <Icono
            etiqueta={c.ajustar ? "Columnas de 150 px" : "Ajustar columnas"}
            aria-pressed={c.ajustar}
            onClick={c.onAjustar}
          >
            <Columns3 className="h-4 w-4" />
          </Icono>
        ) : null}
        <Icono
          etiqueta="Imprimir"
          onClick={() => window.print()}
          className={cn(REDONDO, "hidden lg:inline-flex")}
        >
          <Printer className="h-4 w-4" />
        </Icono>
        <Icono
          etiqueta="Pantalla completa"
          onClick={c.onPantallaCompleta}
          className={cn(REDONDO, "hidden lg:inline-flex")}
        >
          <Expand className="h-4 w-4" />
        </Icono>
        <SelectorBloque bloque={c.bloque} onBloque={c.onBloque} />
        <MenuNuevo permisos={c.permisos} onNuevo={c.onNuevo}>
          <Button size="sm" className="md:h-9 rounded-full" data-guia="cita">
            Nuevo <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </Button>
        </MenuNuevo>
      </div>
    </div>
  );
}
