"use client";

import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { useRouter } from "next/navigation";
import { LogOut, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { quitarEspera, salirDeMisCitas } from "../actions";

export function BotonSalir() {
  const router = useRouter();
  const [ocupado, iniciar] = useTransicionRed();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={ocupado}
      onClick={() =>
        iniciar(async () => {
          await salirDeMisCitas();
          router.refresh();
        })
      }
    >
      <LogOut aria-hidden="true" />
      Salir
    </Button>
  );
}

export function BotonQuitarEspera({
  id,
  descripcion,
}: {
  id: string;
  descripcion: string;
}) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransicionRed();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={ocupado}
      aria-label={`Quitarme de la lista de espera de ${descripcion}`}
      onClick={() =>
        iniciar(async () => {
          const r = await quitarEspera(id);
          if (!r.ok) toast.error(r.error);
          else toast.success("Saliste de la lista de espera");
          router.refresh();
        })
      }
    >
      <X aria-hidden="true" />
      Quitar
    </Button>
  );
}
