"use client";

import { useEffect } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useConexion } from "@/shared/hooks/use-conexion";
import { avisarSinRed } from "@/shared/hooks/use-transicion-red";
import { esErrorDeRed, SIN_RED_PANTALLA } from "@/shared/lib/red";

const HORA = new Intl.DateTimeFormat("es-CO", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Un clic en un enlace de la app que necesitaría pedirle la pantalla al servidor (no un salto dentro de la página). */
function enlaceDeLaApp(e: MouseEvent): HTMLAnchorElement | null {
  if (e.defaultPrevented || e.button !== 0) return null;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
  if (!(a instanceof HTMLAnchorElement)) return null;
  if (a.target === "_blank" || a.hasAttribute("download")) return null;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  const aqui = new URL(window.location.href);
  if (url.pathname === aqui.pathname && url.search === aqui.search && url.hash)
    return null;
  return a;
}

/**
 * Sin red (Fase 11): franja "Sin conexión · lo que ves es de las HH:MM" debajo de la barra, sin tocar el menú
 * (T-11.5); los enlaces de la app no llevan a la página de error del navegador (T-11.7); y una acción que falla
 * por la red fuera de una transición avisa "no se guardó" (T-11.4).
 */
export function AvisoConexion() {
  const { enLinea, desde } = useConexion();

  useEffect(() => {
    if (enLinea) return;
    // En captura y en `window`: antes que el `onClick` de `Link`, que sin red terminaría recargando la página.
    const alClic = (e: MouseEvent) => {
      if (!enlaceDeLaApp(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      toast.error(SIN_RED_PANTALLA, { id: "sin-red-pantalla" });
    };
    window.addEventListener("click", alClic, true);
    return () => window.removeEventListener("click", alClic, true);
  }, [enLinea]);

  useEffect(() => {
    const alRechazo = (e: PromiseRejectionEvent) => {
      if (!esErrorDeRed(e.reason)) return;
      e.preventDefault();
      avisarSinRed();
    };
    window.addEventListener("unhandledrejection", alRechazo);
    return () => window.removeEventListener("unhandledrejection", alRechazo);
  }, []);

  if (enLinea) return null;
  return (
    <div
      role="status"
      className="flex min-h-9 items-center justify-center gap-2 border-b border-ac-aviso/30 bg-ac-aviso/10 px-4 py-1.5 text-center text-sm font-medium text-ac-tinta"
    >
      <WifiOff className="h-4 w-4 shrink-0 text-ac-aviso" aria-hidden="true" />
      <span>
        Sin conexión
        {desde !== null ? ` · lo que ves es de las ${HORA.format(desde)}` : ""}
      </span>
    </div>
  );
}
