"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Copy, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";

const sinCambios = () => () => {};

/** Después de agendar: "¡Listo!" y el enlace para guardar (desde ahí se confirma, cambia o cancela). */
export function ReservaLista({
  cliente,
  token,
}: {
  cliente: string;
  token: string;
}) {
  // La dirección completa (con el dominio) solo existe en el navegador.
  const origen = useSyncExternalStore(
    sinCambios,
    () => window.location.origin,
    () => "",
  );
  const enlace = `${origen}/cita/${token}`;
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    // Quita "?nueva=1": recargar o compartir el enlace no repite el "¡Listo!".
    window.history.replaceState(null, "", `/cita/${token}`);
  }, [token]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar; selecciónalo y cópialo a mano");
    }
  }

  return (
    <section
      role="status"
      className="rounded-lg border border-ac-laguna/40 bg-ac-laguna-claro p-4 sm:p-5"
    >
      <p className="flex items-center gap-2 text-lg font-bold text-ac-laguna-hondo">
        <PartyPopper className="h-5 w-5" aria-hidden="true" />
        ¡Listo, {cliente}! Tu cita quedó agendada
      </p>
      <p className="mt-1">
        Te enviamos la confirmación por correo y WhatsApp (en la demo llegan al
        buzón). Guarda este enlace: desde aquí puedes confirmar, cambiar la hora
        o cancelar.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <code className="min-w-0 flex-1 truncate rounded-md border border-ac-borde bg-ac-papel px-3 py-2 text-sm">
          {enlace}
        </code>
        <Button
          variant="outline"
          className="shrink-0 bg-ac-papel"
          onClick={copiar}
        >
          {copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copiado ? "Copiado" : "Copiar enlace"}
        </Button>
      </div>
    </section>
  );
}
