"use client";

import { Clock } from "lucide-react";
import { DIAS } from "@/shared/lib/formato";
import { cn } from "@/shared/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import type { HorarioDia } from "../types";

/** "Ver horario": la semana del local con el día de hoy marcado. */
export function VerHorario({
  horario,
  hoyIso,
}: {
  horario: HorarioDia[];
  hoyIso: number;
}) {
  const hoy = horario.find((h) => h.dia === hoyIso);
  return (
    <div className="flex items-start gap-3">
      <Clock
        className="mt-0.5 h-4 w-4 shrink-0 text-ac-pizarra"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p>
          {hoy?.abierto
            ? `Hoy de ${hoy.inicio} a ${hoy.fin}`
            : "Hoy está cerrado"}
        </p>
        <Dialog>
          <DialogTrigger className="rounded-sm text-sm font-medium text-ac-laguna underline-offset-2 hover:underline -my-1.5 py-3 md:my-0 md:py-0">
            Ver horario
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Horario de atención</DialogTitle>
            </DialogHeader>
            <ul className="divide-y divide-ac-borde">
              {horario.map((h) => (
                <li
                  key={h.dia}
                  className={cn(
                    "flex justify-between py-2.5",
                    h.dia === hoyIso && "font-semibold text-ac-laguna-hondo",
                  )}
                >
                  <span>
                    {DIAS[h.dia - 1]}
                    {h.dia === hoyIso ? " (hoy)" : ""}
                  </span>
                  <span className={h.abierto ? undefined : "text-ac-neblina"}>
                    {h.abierto ? `${h.inicio} – ${h.fin}` : "Cerrado"}
                  </span>
                </li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
