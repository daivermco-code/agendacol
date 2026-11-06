"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { reiniciarDemo } from "@/features/demo/actions";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

/** Franja de 30 px arriba de todo: avisa que es una demo y deja reiniciarla (solo el dueño). */
export function FranjaDemo({ puedeReiniciar }: { puedeReiniciar: boolean }) {
  const [abierta, setAbierta] = useState(false);
  const [pendiente, iniciar] = useTransicionRed();
  const router = useRouter();

  function confirmar() {
    iniciar(async () => {
      const r = await reiniciarDemo();
      if (r.ok) {
        toast.success("La demo quedó como nueva");
        setAbierta(false);
        router.refresh();
      } else {
        toast.error(r.error, { duration: Infinity });
      }
    });
  }

  return (
    <aside
      aria-label="Aviso de la demo"
      className="flex h-6 items-center justify-center gap-3 bg-ac-demo-fondo px-4 text-[13px] text-ac-demo-texto sm:text-sm md:h-franja"
    >
      <p className="truncate">
        <span className="font-semibold">Demo personal de AgendaCol</span>
        <span className="hidden sm:inline"> · datos inventados</span>
      </p>
      {puedeReiniciar ? (
        <>
          <button
            type="button"
            onClick={() => setAbierta(true)}
            className="area-tactil inline-flex shrink-0 items-center gap-1 self-stretch rounded-sm px-1.5 font-semibold underline-offset-2 hover:underline"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Reiniciar demo</span>
            <span className="sr-only sm:hidden">Reiniciar demo</span>
          </button>
          <Dialog
            open={abierta}
            onOpenChange={(v) => !pendiente && setAbierta(v)}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>¿Reiniciar la demo?</DialogTitle>
                <DialogDescription>
                  Se borran los cambios y vuelven los datos de ejemplo, con la
                  agenda de esta semana.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAbierta(false)}
                  disabled={pendiente}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={confirmar}
                  disabled={pendiente}
                  className="md:min-w-[132px]"
                >
                  {pendiente ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : null}
                  {pendiente ? "Reiniciando…" : "Reiniciar demo"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </aside>
  );
}
