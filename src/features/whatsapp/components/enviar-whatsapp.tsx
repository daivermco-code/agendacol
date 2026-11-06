"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { CONTROL } from "@/features/citas/components/campos-reserva";
import { enviarPlantilla, mensajesParaCita } from "../actions";

/** En la ficha de la cita: elegir una plantilla de WhatsApp, verla con los datos de la cita y mandarla al buzón. */
export function EnviarWhatsapp({ citaId }: { citaId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [elegida, setElegida] = useState("");
  const [enviando, iniciar] = useTransicionRed();
  const { data, isLoading } = useQuery({
    queryKey: ["mensajes-cita", citaId],
    queryFn: async () => {
      const r = await mensajesParaCita(citaId);
      return r.ok ? r.datos : [];
    },
    enabled: abierto,
  });
  const mensajes = data ?? [];
  const mensaje = mensajes.find((m) => m.id === elegida) ?? mensajes[0];

  function enviar() {
    if (!mensaje) return;
    iniciar(async () => {
      const r = await enviarPlantilla({ citaId, plantillaId: mensaje.id });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`«${mensaje.nombre}» enviado. Míralo en el buzón.`);
      setAbierto(false);
    });
  }

  if (!abierto)
    return (
      <div className="border-t border-ac-borde pt-3">
        <Button variant="outline" size="sm" onClick={() => setAbierto(true)}>
          <MessageCircle className="h-4 w-4" aria-hidden="true" /> Enviar
          WhatsApp
        </Button>
      </div>
    );

  return (
    <div className="space-y-2 border-t border-ac-borde pt-3 text-sm">
      <p className="font-medium">Enviar WhatsApp</p>
      {isLoading ? (
        <p className="flex items-center gap-2 text-ac-pizarra">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{" "}
          Cargando plantillas…
        </p>
      ) : !mensaje ? (
        <p className="text-ac-pizarra">
          No hay plantillas activas.{" "}
          <Link
            href="/administracion/whatsapp"
            className="text-ac-laguna-hondo underline"
          >
            Créalas en Administración
          </Link>
          .
        </p>
      ) : (
        <>
          <label className="block">
            <span className="sr-only">Plantilla</span>
            <select
              className={CONTROL}
              value={mensaje.id}
              onChange={(e) => setElegida(e.target.value)}
            >
              {mensajes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </label>
          <p className="whitespace-pre-line rounded-lg rounded-tl-none bg-ac-exito-fondo px-3 py-2 text-ac-tinta">
            {mensaje.texto}
          </p>
        </>
      )}
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAbierto(false)}
          disabled={enviando}
        >
          Cancelar
        </Button>
        <Button size="sm" onClick={enviar} disabled={!mensaje || enviando}>
          {enviando ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
          Enviar
        </Button>
      </div>
    </div>
  );
}
