"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useConfirmar } from "@/shared/components/confirmar";
import { Button } from "@/shared/ui/button";

interface Props {
  visible: boolean;
  guardando: boolean;
  onCancelar: () => void;
  onGuardar: () => void;
}

/**
 * Barra fija abajo cuando hay cambios sin guardar. Mientras está visible, salir de la página
 * (enlaces internos o cerrar la pestaña) pregunta "¿Salir sin guardar?".
 */
export function BarraCambiosPendientes({
  visible,
  guardando,
  onCancelar,
  onGuardar,
}: Props) {
  const router = useRouter();
  const [dialogo, confirmar] = useConfirmar();

  useEffect(() => {
    if (!visible) return;
    const antesDeSalir = (e: BeforeUnloadEvent) => e.preventDefault();
    const alHacerClic = (e: MouseEvent) => {
      const enlace = (e.target as HTMLElement | null)?.closest("a");
      if (!enlace || enlace.target === "_blank" || e.ctrlKey || e.metaKey)
        return;
      const url = new URL(enlace.href, window.location.href);
      if (
        url.origin !== window.location.origin ||
        url.pathname === window.location.pathname
      )
        return;
      e.preventDefault();
      e.stopPropagation();
      void confirmar({
        titulo: "¿Salir sin guardar?",
        texto:
          "Tienes cambios pendientes en esta sección. Si sales, se pierden.",
        aceptar: "Salir sin guardar",
        peligro: true,
      }).then((salir) => {
        if (salir) router.push(url.pathname + url.search);
      });
    };
    window.addEventListener("beforeunload", antesDeSalir);
    document.addEventListener("click", alHacerClic, true);
    return () => {
      window.removeEventListener("beforeunload", antesDeSalir);
      document.removeEventListener("click", alHacerClic, true);
    };
  }, [visible, confirmar, router]);

  return (
    <>
      {visible ? (
        <div className="fixed inset-x-0 bottom-[var(--alto-pestanas)] z-40 animate-entra-abajo border-t border-ac-borde bg-ac-papel shadow-flota">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
            <p className="font-medium">Tienes cambios pendientes de guardar</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onCancelar}
                disabled={guardando}
              >
                Cancelar
              </Button>
              <Button onClick={onGuardar} disabled={guardando}>
                {guardando ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : null}
                Guardar cambios
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {dialogo}
    </>
  );
}
