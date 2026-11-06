"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  Armchair,
  Ban,
  Clock,
  Coffee,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import type { RevisionFecha, TipoChoque } from "../types";

const ICONO: Record<TipoChoque, typeof Clock> = {
  cita_profesional: User,
  cita_cliente: Users,
  fuera_horario: Clock,
  descanso: Coffee,
  bloqueo: Ban,
  recurso: Armchair,
};

export interface ChoquesPendientes {
  choques: RevisionFecha[];
  puedeForzar: boolean;
  /** Fechas de la serie que no chocan (si hay, se puede agendar solo esas). */
  libres: number;
}

/** "Hay un choque de horario": qué choca y, si los ajustes lo dejan, agendar de todas formas. */
export function VentanaChoques({
  pendientes,
  guardando,
  onForzar,
  onSinChoques,
  onVolver,
  textoForzar = "Agendar de todas formas",
}: {
  pendientes: ChoquesPendientes | null;
  guardando: boolean;
  onForzar: () => void;
  onSinChoques?: () => void;
  onVolver: () => void;
  /** Al mover una cita: "Mover igual". */
  textoForzar?: string;
}) {
  const varias =
    (pendientes?.choques.length ?? 0) > 1 || (pendientes?.libres ?? 0) > 0;
  return (
    <Dialog
      open={pendientes !== null}
      onOpenChange={(v) => !v && !guardando && onVolver()}
    >
      <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle
              className="h-5 w-5 text-ac-aviso"
              aria-hidden="true"
            />
            Hay un choque de horario
          </DialogTitle>
          <DialogDescription>
            {pendientes?.puedeForzar
              ? "Puedes agendarla igual: tus ajustes permiten estas reservas."
              : "Tus ajustes no permiten agendar con estos choques. Cambia la hora o el profesional, o actívalo en Ajustes → Agenda."}
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-64 space-y-2 overflow-y-auto">
          {pendientes?.choques.map((r) => (
            <li
              key={r.fecha}
              className="rounded-md border border-ac-borde p-2.5 text-sm"
            >
              {varias ? (
                <p className="cifras mb-1 font-semibold">
                  {format(parseISO(r.fecha), "EEEE dd/MM/yyyy", { locale: es })}
                </p>
              ) : null}
              <ul className="space-y-1">
                {r.choques.map((c) => {
                  const Icono = ICONO[c.tipo];
                  return (
                    <li
                      key={`${c.tipo}-${c.resumen}`}
                      className="flex items-start gap-2"
                    >
                      <Icono
                        className="mt-0.5 h-4 w-4 shrink-0 text-ac-pizarra"
                        aria-hidden="true"
                      />
                      {c.resumen}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onVolver} disabled={guardando}>
            Volver
          </Button>
          {onSinChoques && pendientes && pendientes.libres > 0 ? (
            <Button
              variant="outline"
              onClick={onSinChoques}
              disabled={guardando}
            >
              Agendar solo las libres ({pendientes.libres})
            </Button>
          ) : null}
          {pendientes?.puedeForzar ? (
            <Button onClick={onForzar} disabled={guardando}>
              {textoForzar}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
