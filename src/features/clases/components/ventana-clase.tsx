"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CLAVE_AGENDA } from "@/features/agenda/hooks/use-agenda";
import type { ClaseCatalogo, ProfesionalAgenda } from "@/features/agenda/types";
import {
  CONTROL,
  SelectorHora,
} from "@/features/citas/components/campos-reserva";
import { Campo } from "@/shared/components/campo";
import { duracion, pesos } from "@/shared/lib/formato";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { guardarClase } from "../actions";
import type { DatosClase } from "../schemas";

const VECES = [1, 2, 4, 8, 12];

/** Crear una clase (con cupo, y si se quiere cada semana) o editar una sesión de la agenda. */
export function VentanaClase({
  inicial,
  clases,
  profesionales,
  onCerrar,
}: {
  inicial: DatosClase;
  clases: ClaseCatalogo[];
  profesionales: ProfesionalAgenda[];
  onCerrar: () => void;
}) {
  const qc = useQueryClient();
  const [d, setD] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransicionRed();
  const cambiar = (c: Partial<DatosClase>) => setD((x) => ({ ...x, ...c }));
  const clase = clases.find((c) => c.id === d.servicioId);
  const quienes = profesionales.filter(
    (p) => !clase?.profesionales.length || clase.profesionales.includes(p.id),
  );
  const editando = Boolean(d.id);

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await guardarClase(d);
      if (!r.ok) return setError(r.error);
      toast.success(
        editando
          ? "Clase guardada"
          : d.veces > 1
            ? `${d.veces} clases agendadas`
            : "Clase agendada",
      );
      void qc.invalidateQueries({ queryKey: [CLAVE_AGENDA] });
      onCerrar();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !guardando && onCerrar()}>
      <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar clase" : "Nueva clase"}</DialogTitle>
          <DialogDescription>
            Ocupa al profesional como una cita; los clientes se inscriben desde
            la clase hasta llenar el cupo.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          <Campo id="clase-servicio" etiqueta="Clase" obligatorio>
            <select
              id="clase-servicio"
              className={CONTROL}
              value={d.servicioId ?? ""}
              disabled={editando}
              onChange={(e) => {
                const nueva = clases.find((c) => c.id === e.target.value);
                cambiar({
                  servicioId: e.target.value,
                  cupo: nueva?.cupo ?? d.cupo,
                });
              }}
            >
              {clases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Campo>
          {clase ? (
            <p className="cifras -mt-2 text-sm text-ac-pizarra">
              {duracion(clase.duracionMin)} · {pesos(clase.precio)} por persona
            </p>
          ) : null}
          <Campo id="clase-profesional" etiqueta="La da" obligatorio>
            <select
              id="clase-profesional"
              className={CONTROL}
              value={d.profesionalId}
              onChange={(e) => cambiar({ profesionalId: e.target.value })}
            >
              <option value="">Elige quién da la clase</option>
              {quienes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo id="clase-fecha" etiqueta="Día" obligatorio>
              <Input
                id="clase-fecha"
                type="date"
                value={d.fecha}
                onChange={(e) => cambiar({ fecha: e.target.value })}
              />
            </Campo>
            <Campo id="clase-hora" etiqueta="Hora" obligatorio>
              <SelectorHora
                id="clase-hora"
                valor={d.horaInicio}
                onCambio={(horaInicio) => cambiar({ horaInicio })}
              />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo id="clase-cupo" etiqueta="Cupo" obligatorio>
              <Input
                id="clase-cupo"
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                className="cifras"
                value={Number.isNaN(d.cupo) ? "" : d.cupo}
                onChange={(e) =>
                  cambiar({
                    cupo:
                      e.target.value === ""
                        ? Number.NaN
                        : Number(e.target.value),
                  })
                }
              />
            </Campo>
            {editando ? null : (
              <Campo id="clase-veces" etiqueta="Repetir">
                <select
                  id="clase-veces"
                  className={CONTROL}
                  value={d.veces}
                  onChange={(e) => cambiar({ veces: Number(e.target.value) })}
                >
                  {VECES.map((v) => (
                    <option key={v} value={v}>
                      {v === 1 ? "Solo esta vez" : `Cada semana, ${v} veces`}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
          </div>
          <Campo
            id="clase-nota"
            etiqueta="Nota"
            ayuda="La ven el equipo y la lista de la clase"
          >
            <Input
              id="clase-nota"
              value={d.nota}
              maxLength={300}
              onChange={(e) => cambiar({ nota: e.target.value })}
            />
          </Campo>
          {error ? (
            <p role="alert" className="text-sm text-ac-error">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onCerrar}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {editando ? "Guardar" : "Agendar clase"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
