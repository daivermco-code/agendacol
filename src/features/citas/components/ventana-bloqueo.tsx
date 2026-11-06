"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Campo } from "@/shared/components/campo";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import { CLAVE_AGENDA } from "@/features/agenda/hooks/use-agenda";
import { aHora, aMinutos } from "@/features/agenda/lib/fechas";
import type { BloqueoAgenda, ProfesionalAgenda } from "@/features/agenda/types";
import { borrarBloqueo, guardarBloqueo } from "../actions";
import {
  CADAS,
  NOMBRE_CADA,
  type Alcance,
  type Cada,
  type Repetir,
} from "../schemas";
import { CONTROL, SelectorHora } from "./campos-reserva";

export interface FormBloqueo {
  id?: string;
  serieId: string | null;
  profesionalId: string;
  motivo: string;
  fechaInicio: string;
  horaInicio: string;
  fechaFin: string;
  horaFin: string;
  repetir: Repetir | null;
}

const MOTIVOS = ["Almuerzo", "Descanso", "Reunión", "Diligencia", "Vacaciones"];

export function bloqueoNuevo(
  fecha: string,
  hora: string,
  profesionalId: string,
): FormBloqueo {
  return {
    serieId: null,
    profesionalId,
    motivo: "",
    fechaInicio: fecha,
    horaInicio: hora,
    fechaFin: fecha,
    horaFin: aHora(Math.min(aMinutos(hora) + 60, 23 * 60 + 59)),
    repetir: null,
  };
}

export function bloqueoDe(b: BloqueoAgenda): FormBloqueo {
  return {
    id: b.id,
    serieId: b.serieId,
    profesionalId: b.profesionalId,
    motivo: b.motivo,
    fechaInicio: b.inicio.slice(0, 10),
    horaInicio: b.inicio.slice(11, 16),
    fechaFin: b.fin.slice(0, 10),
    horaFin: b.fin.slice(11, 16),
    repetir: null,
  };
}

/** "Bloqueo de horas": motivo, profesional, inicio, fin y repetir; al editar, también eliminar. */
export function VentanaBloqueo({
  inicial,
  profesionales,
  onCerrar,
}: {
  inicial: FormBloqueo;
  profesionales: ProfesionalAgenda[];
  onCerrar: () => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState<FormBloqueo>(inicial);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [borrando, setBorrando] = useState<Alcance | null>(null);
  const [guardando, iniciar] = useTransicionRed();
  const cambiar = (c: Partial<FormBloqueo>) => {
    setF((x) => ({ ...x, ...c }));
    setErrores({});
  };
  const listo = (texto: string) => {
    void qc.invalidateQueries({ queryKey: [CLAVE_AGENDA] });
    toast.success(texto);
    onCerrar();
  };

  function guardar() {
    iniciar(async () => {
      const r = await guardarBloqueo(f);
      if (r.ok) return listo(f.id ? "Bloqueo guardado" : "Horario bloqueado");
      if (r.campo) setErrores({ [r.campo]: r.error });
      else toast.error(r.error, { duration: Infinity });
    });
  }
  function borrar(alcance: Alcance) {
    if (!f.id) return;
    const id = f.id;
    iniciar(async () => {
      const r = await borrarBloqueo(id, alcance);
      if (r.ok) listo("Bloqueo eliminado");
      else toast.error(r.error, { duration: Infinity });
    });
  }

  const campoFecha = (
    clave: "fechaInicio" | "fechaFin",
    hora: "horaInicio" | "horaFin",
    etiqueta: string,
  ) => (
    <Campo
      id={`bloqueo-${clave}`}
      etiqueta={etiqueta}
      obligatorio
      error={errores[hora] ?? errores[clave]}
    >
      <div className="flex gap-2">
        <Input
          id={`bloqueo-${clave}`}
          type="date"
          value={f[clave]}
          onChange={(e) =>
            e.target.value && cambiar({ [clave]: e.target.value })
          }
        />
        <SelectorHora
          nombre={`Hora de ${etiqueta.toLowerCase()}`}
          valor={f[hora]}
          onCambio={(v) => cambiar({ [hora]: v })}
        />
      </div>
    </Campo>
  );

  return (
    <Dialog open onOpenChange={(v) => !v && !guardando && onCerrar()}>
      <DialogContent className="h-dvh max-h-dvh max-w-full rounded-none sm:rounded-none overflow-y-auto md:h-auto md:max-h-[92dvh] md:max-w-lg md:rounded-lg">
        <DialogHeader>
          <DialogTitle>
            {f.id ? "Editar bloqueo" : "Bloquear horario"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Campo
            id="bloqueo-motivo"
            etiqueta="Motivo"
            obligatorio
            error={errores.motivo}
          >
            <Input
              id="bloqueo-motivo"
              maxLength={80}
              placeholder="Por ejemplo, almuerzo"
              value={f.motivo}
              onChange={(e) => cambiar({ motivo: e.target.value })}
            />
          </Campo>
          <div
            className="flex flex-wrap gap-1.5"
            aria-label="Motivos frecuentes"
          >
            {MOTIVOS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => cambiar({ motivo: m })}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[13px] min-h-11 md:min-h-0",
                  f.motivo === m
                    ? "border-ac-laguna bg-ac-laguna-claro text-ac-laguna-hondo"
                    : "border-ac-borde hover:bg-ac-niebla",
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <Campo
            id="bloqueo-profesional"
            etiqueta="Profesional"
            obligatorio
            error={errores.profesionalId}
          >
            <select
              id="bloqueo-profesional"
              className={CONTROL}
              value={f.profesionalId}
              onChange={(e) => cambiar({ profesionalId: e.target.value })}
            >
              <option value="">Elige un profesional</option>
              {profesionales.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </Campo>
          {campoFecha("fechaInicio", "horaInicio", "Inicio")}
          {campoFecha("fechaFin", "horaFin", "Fin")}
          {f.id ? null : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="bloqueo-repetir"
                  checked={f.repetir !== null}
                  onCheckedChange={(v) =>
                    cambiar({
                      repetir: v === true ? { cada: "semana", veces: 4 } : null,
                    })
                  }
                />
                <Label htmlFor="bloqueo-repetir" className="font-normal">
                  Repetir bloqueo
                </Label>
              </div>
              {f.repetir ? (
                <div className="flex gap-2">
                  <select
                    aria-label="Cada cuánto"
                    className={CONTROL}
                    value={f.repetir.cada}
                    onChange={(e) =>
                      f.repetir &&
                      cambiar({
                        repetir: { ...f.repetir, cada: e.target.value as Cada },
                      })
                    }
                  >
                    {CADAS.map((c) => (
                      <option key={c} value={c}>
                        {NOMBRE_CADA[c]}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Cuántas veces"
                    className={CONTROL}
                    value={f.repetir.veces}
                    onChange={(e) =>
                      f.repetir &&
                      cambiar({
                        repetir: {
                          ...f.repetir,
                          veces: Number(e.target.value),
                        },
                      })
                    }
                  >
                    {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
                      <option key={n} value={n}>
                        {n} veces
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          )}
          {borrando ? (
            <div
              className="space-y-3 rounded-lg border border-ac-error/40 bg-ac-error/5 p-3"
              role="alert"
            >
              <p className="text-sm font-semibold">¿Eliminar este bloqueo?</p>
              {f.serieId ? (
                <RadioGroup
                  value={borrando}
                  onValueChange={(v) => setBorrando(v as Alcance)}
                  aria-label="Qué eliminar"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <RadioGroupItem id="borrar-este" value="solo_esta" />
                    <Label htmlFor="borrar-este" className="font-normal">
                      Solo este
                    </Label>
                  </span>
                  <span className="flex items-center gap-2 text-sm">
                    <RadioGroupItem
                      id="borrar-siguientes"
                      value="esta_y_siguientes"
                    />
                    <Label htmlFor="borrar-siguientes" className="font-normal">
                      Este y los siguientes
                    </Label>
                  </span>
                </RadioGroup>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBorrando(null)}
                  disabled={guardando}
                >
                  No
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => borrar(borrando)}
                  disabled={guardando}
                >
                  Eliminar
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter className="gap-2">
          {f.id && !borrando ? (
            <Button
              variant="ghost"
              className="mr-auto text-ac-error"
              onClick={() => setBorrando("solo_esta")}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Eliminar
            </Button>
          ) : null}
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {f.id ? "Guardar" : "Bloquear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
