"use client";

import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { useRouter } from "next/navigation";
import { Loader2, Reply } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { responderAviso } from "../actions";

/** Botón de la demo para contestar el WhatsApp como si fuera el cliente. */
export function ResponderAviso({ avisoId }: { avisoId: string }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransicionRed();

  function responder() {
    iniciar(async () => {
      const r = await responderAviso(avisoId);
      if (!r.ok) return void toast.error(r.error);
      toast.success("El cliente respondió. Su cita quedó confirmada");
      router.refresh();
    });
  }

  return (
    <Button size="sm" onClick={responder} disabled={pendiente}>
      {pendiente ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : (
        <Reply aria-hidden="true" />
      )}
      Responder: SÍ, confirmo
    </Button>
  );
}
