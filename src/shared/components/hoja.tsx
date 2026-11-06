"use client";

import { useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/shared/ui/drawer";

interface HojaProps {
  abierta: boolean;
  onCambiar: (abierta: boolean) => void;
  titulo: string;
  /** Para lectores de pantalla; se ve solo si se pide. */
  descripcion?: string;
  /** El contenido ya trae su propio título visible (la ficha de la cita). */
  tituloOculto?: boolean;
  /** El contenido ya trae su propio botón de cerrar: así no quedan dos con el mismo nombre. */
  sinCerrar?: boolean;
  etiquetaCerrar?: string;
  /** Botones fijos abajo (por ejemplo "Listo"). */
  pie?: ReactNode;
  className?: string;
  /** Clases del cuerpo con desplazamiento (por ejemplo, sin relleno si el contenido ya trae el suyo). */
  cuerpo?: string;
  /** Escape antes de cerrar: con `preventDefault()` la hoja sigue abierta (por ejemplo, para cancelar una edición). */
  alEscape?: (e: KeyboardEvent) => void;
  /** Adónde va el foco al cerrar, si no es a lo que la abrió (por ejemplo, porque eso se va a borrar). */
  volverA?: () => HTMLElement | null;
  children: ReactNode;
}

/**
 * Hoja desde abajo del celular (T-12.4): asa, título de 18 px y "Cerrar" de 44 px; se cierra arrastrando,
 * con Escape o tocando fuera. Quien la usa decide con `useEsCelular` qué abre desde `md:` (la ventana o el
 * panel de hoy); solo se abre tras una acción, así que el `true` del servidor no cambia la hidratación.
 */
export function Hoja({
  abierta,
  onCambiar,
  titulo,
  descripcion,
  tituloOculto = false,
  sinCerrar = false,
  etiquetaCerrar = "Cerrar",
  pie,
  className,
  cuerpo,
  alEscape,
  volverA,
  children,
}: HojaProps) {
  // La hoja se abre sin disparador de vaul: al cerrarla, el foco vuelve a lo que la abrió (si sigue ahí).
  const origen = useRef<HTMLElement | null>(null);
  return (
    <Drawer open={abierta} onOpenChange={onCambiar}>
      <DrawerContent
        className={className}
        onEscapeKeyDown={alEscape}
        onOpenAutoFocus={(e) => {
          const a = document.activeElement;
          origen.current =
            a instanceof HTMLElement && a !== document.body ? a : null;
          // vaul no deja que Radix mueva el foco (autoFocus=false): sin esto el foco se queda detrás de la hoja y
          // el Tab recorre la pantalla de abajo. Va a la hoja misma, no a su primer botón.
          e.preventDefault();
          if (e.currentTarget instanceof HTMLElement)
            e.currentTarget.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={(e) => {
          const o = volverA?.() ?? origen.current;
          origen.current = null;
          if (o?.isConnected) {
            e.preventDefault();
            o.focus();
          }
        }}
      >
        <div
          className={cn(
            "flex items-center gap-2 px-4 pt-1",
            tituloOculto && sinCerrar && "sr-only",
          )}
        >
          <DrawerTitle
            className={cn("min-w-0 flex-1", tituloOculto && "sr-only")}
          >
            {titulo}
          </DrawerTitle>
          {sinCerrar ? null : (
            <DrawerClose
              aria-label={etiquetaCerrar}
              className="-mr-2 ml-auto inline-flex h-11 w-11 items-center justify-center rounded-full text-ac-pizarra hover:bg-ac-niebla"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </DrawerClose>
          )}
        </div>
        <DrawerDescription className="sr-only">
          {descripcion ?? titulo}
        </DrawerDescription>
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2",
            cuerpo,
          )}
        >
          {children}
        </div>
        {pie ? (
          <div className="border-t border-ac-borde px-4 py-3">{pie}</div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
