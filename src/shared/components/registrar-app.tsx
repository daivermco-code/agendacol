"use client";

import { useEffect } from "react";
import { useInstalarApp, type EventoInstalar } from "@/shared/lib/instalar-app";

/**
 * Registra el service worker de la app instalable y guarda el aviso de instalación de Chrome. Va en el layout
 * raíz: si se quita, la app deja de poder instalarse sin que nada falle a la vista. El service worker solo en
 * producción, para no mezclarse con el servidor de desarrollo.
 */
export function RegistrarApp() {
  const guardar = useInstalarApp((s) => s.guardar);

  useEffect(() => {
    function alPoderInstalar(e: Event) {
      e.preventDefault();
      guardar(e as EventoInstalar);
    }
    function alInstalar() {
      guardar(null);
    }
    window.addEventListener("beforeinstallprompt", alPoderInstalar);
    window.addEventListener("appinstalled", alInstalar);

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      // Con el origen completo: Safari de iPhone rechaza el registro si hay una redirección de por medio.
      navigator.serviceWorker
        .register(`${window.location.origin}/sw.js`, { scope: "/" })
        .catch(() => {
          // Sin service worker la app sigue funcionando en el navegador; solo no se ofrece instalarla.
        });
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", alPoderInstalar);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, [guardar]);

  return null;
}
