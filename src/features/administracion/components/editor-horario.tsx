"use client";

import { Copy } from "lucide-react";
import { DIAS } from "@/shared/lib/formato";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { esquemaDia, type DiaHorario } from "../schemas";

interface EditorHorarioProps {
  valor: DiaHorario[];
  onChange: (dias: DiaHorario[]) => void;
  etiquetaActivo?: string;
  /** Horario del local: si un día sale de él, se avisa (profesionales). */
  referencia?: DiaHorario[];
}

/** Primer error de cada día (o null). */
export function erroresHorario(dias: DiaHorario[]): (string | null)[] {
  return dias.map((d) => {
    const r = esquemaDia.safeParse(d);
    return r.success ? null : (r.error.issues[0]?.message ?? "Revisa este día");
  });
}

function saleDelLocal(d: DiaHorario, ref?: DiaHorario): boolean {
  if (!ref || !d.activo || !d.inicio || !d.fin) return false;
  if (!ref.activo) return true;
  return d.inicio < ref.inicio || d.fin > ref.fin;
}

const HORA = "w-[104px] px-2 cifras";

export function EditorHorario({
  valor,
  onChange,
  etiquetaActivo = "Abierto",
  referencia,
}: EditorHorarioProps) {
  const errores = erroresHorario(valor);

  function cambiar(i: number, cambio: Partial<DiaHorario>) {
    onChange(valor.map((d, j) => (j === i ? { ...d, ...cambio } : d)));
  }

  function copiarEnTodos() {
    const base = valor[0];
    onChange(
      valor.map((d) => (d.activo ? { ...base, dia: d.dia, activo: true } : d)),
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={copiarEnTodos}
        >
          <Copy className="h-4 w-4" aria-hidden="true" /> Copiar el lunes en
          todos
        </Button>
      </div>
      <ul className="divide-y divide-ac-borde rounded-lg border border-ac-borde">
        {valor.map((d, i) => (
          <li key={d.dia} className="px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <label className="flex w-[148px] items-center gap-2 font-medium">
                <Switch
                  checked={d.activo}
                  onCheckedChange={(v) => cambiar(i, { activo: v })}
                  aria-label={`${DIAS[i]}: ${etiquetaActivo}`}
                />
                {DIAS[i]}
              </label>
              {d.activo ? (
                <>
                  <span className="flex items-center gap-1.5">
                    <Input
                      type="time"
                      step={300}
                      value={d.inicio}
                      onChange={(e) => cambiar(i, { inicio: e.target.value })}
                      className={HORA}
                      aria-label={`${DIAS[i]}: apertura`}
                    />
                    <span className="text-ac-neblina">a</span>
                    <Input
                      type="time"
                      step={300}
                      value={d.fin}
                      onChange={(e) => cambiar(i, { fin: e.target.value })}
                      className={HORA}
                      aria-label={`${DIAS[i]}: cierre`}
                    />
                  </span>
                  <label className="flex items-center gap-2 text-sm text-ac-pizarra">
                    <Checkbox
                      checked={d.descanso}
                      onCheckedChange={(v) =>
                        cambiar(i, { descanso: v === true })
                      }
                    />
                    Descanso
                  </label>
                  {d.descanso ? (
                    <span className="flex items-center gap-1.5">
                      <Input
                        type="time"
                        step={300}
                        value={d.descansoInicio}
                        onChange={(e) =>
                          cambiar(i, { descansoInicio: e.target.value })
                        }
                        className={HORA}
                        aria-label={`${DIAS[i]}: inicio del descanso`}
                      />
                      <span className="text-ac-neblina">a</span>
                      <Input
                        type="time"
                        step={300}
                        value={d.descansoFin}
                        onChange={(e) =>
                          cambiar(i, { descansoFin: e.target.value })
                        }
                        className={HORA}
                        aria-label={`${DIAS[i]}: fin del descanso`}
                      />
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="text-sm text-ac-neblina">
                  {etiquetaActivo === "Abierto" ? "Cerrado" : "No trabaja"}
                </span>
              )}
            </div>
            {errores[i] ? (
              <p className="mt-1.5 text-xs text-ac-error">{errores[i]}</p>
            ) : null}
            {!errores[i] && saleDelLocal(d, referencia?.[i]) ? (
              <p className={cn("mt-1.5 text-xs text-ac-aviso")}>
                Este horario sale del horario del local
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
