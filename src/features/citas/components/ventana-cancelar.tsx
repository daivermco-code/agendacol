"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Campo } from "@/shared/components/campo";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import { Textarea } from "@/shared/ui/textarea";
import { CLAVE_AGENDA } from "@/features/agenda/hooks/use-agenda";
import type { CitaAgenda } from "@/features/agenda/types";
import { cancelarCita, eliminarCita } from "../actions";
import type { AlcanceCancelar } from "../schemas";

type Accion = "cancelar" | "eliminar";

function Opciones<T extends string>({
  nombre,
  valor,
  opciones,
  onCambio,
}: {
  nombre: string;
  valor: T;
  opciones: { valor: T; texto: string; ayuda?: string }[];
  onCambio: (v: T) => void;
}) {
  return (
    <RadioGroup
      value={valor}
      onValueChange={(v) => onCambio(v as T)}
      aria-label={nombre}
      className="gap-2"
    >
      {opciones.map((o) => (
        <div key={o.valor} className="flex items-start gap-2">
          <RadioGroupItem
            id={`${nombre}-${o.valor}`}
            value={o.valor}
            className="mt-0.5"
          />
          <Label
            htmlFor={`${nombre}-${o.valor}`}
            className="font-normal leading-snug"
          >
            {o.texto}
            {o.ayuda ? (
              <span className="block text-xs text-ac-pizarra">{o.ayuda}</span>
            ) : null}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}

/** Papelera de la ficha: cancelar (queda en el historial y se avisa) o eliminar, con alcance si es serie. */
export function VentanaCancelar({
  cita,
  onCerrar,
}: {
  cita: CitaAgenda;
  onCerrar: () => void;
}) {
  const qc = useQueryClient();
  const [accion, setAccion] = useState<Accion>(
    cita.estado === "cancelado" ? "eliminar" : "cancelar",
  );
  const [alcance, setAlcance] = useState<AlcanceCancelar>("solo_esta");
  const [motivo, setMotivo] = useState("");
  const [guardando, iniciar] = useTransicionRed();

  function confirmar() {
    iniciar(async () => {
      const r =
        accion === "cancelar"
          ? await cancelarCita(cita.id, alcance, motivo)
          : await eliminarCita(cita.id, alcance);
      if (!r.ok) {
        toast.error(r.error, { duration: Infinity });
        return;
      }
      void qc.invalidateQueries({ queryKey: [CLAVE_AGENDA] });
      toast.success(
        accion === "cancelar" ? "Cita cancelada" : "Cita eliminada",
      );
      onCerrar();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !guardando && onCerrar()}>
      <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>¿Qué hacemos con esta cita?</DialogTitle>
          <DialogDescription>
            {cita.clienteNombre} · {cita.servicioNombre} ·{" "}
            {cita.fecha.split("-").reverse().join("/")} {cita.horaInicio}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {cita.estado === "cancelado" ? null : (
            <Opciones<Accion>
              nombre="accion"
              valor={accion}
              onCambio={setAccion}
              opciones={[
                {
                  valor: "cancelar",
                  texto: "Cancelar",
                  ayuda: "Queda en «Canceladas» y se le avisa al cliente.",
                },
                {
                  valor: "eliminar",
                  texto: "Eliminar",
                  ayuda: "Se borra sin aviso ni historial.",
                },
              ]}
            />
          )}
          {cita.serieId ? (
            <fieldset className="space-y-2 border-t border-ac-borde pt-3">
              <legend className="mb-2 text-sm font-medium">
                Es parte de una serie
              </legend>
              <Opciones<AlcanceCancelar>
                nombre="alcance"
                valor={alcance}
                onCambio={setAlcance}
                opciones={[
                  { valor: "solo_esta", texto: "Solo esta" },
                  {
                    valor: "esta_y_siguientes",
                    texto: "Esta y las siguientes",
                  },
                  { valor: "toda_la_serie", texto: "Toda la serie" },
                ]}
              />
            </fieldset>
          ) : null}
          {accion === "cancelar" ? (
            <Campo id="cancelar-motivo" etiqueta="Motivo (opcional)">
              <Textarea
                id="cancelar-motivo"
                rows={2}
                maxLength={200}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </Campo>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Volver
          </Button>
          <Button
            variant="destructive"
            onClick={confirmar}
            disabled={guardando}
          >
            {guardando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {accion === "cancelar" ? "Cancelar cita" : "Eliminar cita"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
