"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { Loader2, Pencil, Plus, Star, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Campo } from "@/shared/components/campo";
import { Vacio } from "@/shared/components/vacio";
import { cn, iniciales } from "@/shared/lib/utils";
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
import { Switch } from "@/shared/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { guardarProfesional } from "../actions";
import { esquemaProfesional, type DatosProfesional } from "../schemas";
import type { DatosEquipo } from "../services/catalogo";
import { EditorHorario, erroresHorario } from "./editor-horario";

const COLORES = [
  "#0E7490",
  "#B45309",
  "#BE185D",
  "#4D7C0F",
  "#1D4ED8",
  "#7C2D12",
  "#0F766E",
  "#9F1239",
];

const PROMEDIO = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Promedio privado de lo que califican los clientes después de ser atendidos. */
function NotaProfesional({
  calificacion,
}: {
  calificacion: DatosEquipo["profesionales"][number]["calificacion"];
}) {
  if (!calificacion)
    return (
      <span className="mt-0.5 block text-[13px] text-ac-neblina">
        Sin calificaciones todavía
      </span>
    );
  const { promedio, cuantas } = calificacion;
  return (
    <span
      className="mt-0.5 flex items-center gap-1 text-[13px]"
      aria-label={`Calificación promedio ${PROMEDIO.format(promedio)} de 5, ${cuantas} ${cuantas === 1 ? "calificación" : "calificaciones"}`}
    >
      <Star
        className="h-3.5 w-3.5 fill-ac-aviso text-ac-aviso"
        aria-hidden="true"
      />
      <span className="cifras font-semibold">{PROMEDIO.format(promedio)}</span>
      <span className="text-ac-pizarra">
        · {cuantas} {cuantas === 1 ? "calificación" : "calificaciones"}
      </span>
    </span>
  );
}

function Formulario({
  equipo,
  inicial,
  onCerrar,
}: {
  equipo: DatosEquipo;
  inicial: DatosProfesional;
  onCerrar: () => void;
}) {
  const [d, setD] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransicionRed();
  const cambiar = (c: Partial<DatosProfesional>) =>
    setD((x) => ({ ...x, ...c }));
  const local = equipo.locales.find((l) => l.id === d.localId);
  const todos = equipo.servicios.every((s) => d.servicios.includes(s.id));

  function guardar() {
    const p = esquemaProfesional.safeParse(d);
    if (!p.success)
      return setError(p.error.issues[0]?.message ?? "Revisa los datos");
    setError(null);
    iniciar(async () => {
      const r = await guardarProfesional(p.data);
      if (r.ok) {
        toast.success(d.id ? "Profesional guardado" : "Profesional creado");
        onCerrar();
      } else toast.error(r.error, { duration: Infinity });
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !guardando && onCerrar()}>
      <DialogContent className="h-dvh max-h-dvh max-w-3xl rounded-none sm:rounded-none overflow-y-auto md:h-auto md:max-h-[92dvh] md:rounded-lg">
        <DialogHeader>
          <DialogTitle>
            {d.id ? `Editar a ${inicial.nombre}` : "Nuevo profesional"}
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="datos">
          <TabsList>
            <TabsTrigger value="datos">Datos</TabsTrigger>
            <TabsTrigger value="servicios">
              Servicios ({d.servicios.length})
            </TabsTrigger>
            <TabsTrigger value="horario">Horario</TabsTrigger>
          </TabsList>
          <TabsContent value="datos" className="grid gap-4 pt-2 sm:grid-cols-2">
            <Campo
              id="nombre"
              etiqueta="Nombre"
              obligatorio
              className="sm:col-span-2"
            >
              <Input
                id="nombre"
                value={d.nombre}
                onChange={(e) => cambiar({ nombre: e.target.value })}
              />
            </Campo>
            <Campo id="local" etiqueta="Local" obligatorio>
              <select
                id="local"
                value={d.localId}
                onChange={(e) => cambiar({ localId: e.target.value })}
                className="h-11 w-full rounded-md border border-ac-borde bg-ac-papel px-3 md:h-9"
              >
                {equipo.locales.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">
                Color en la agenda
              </legend>
              <div className="flex flex-wrap gap-4 md:gap-2">
                {COLORES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => cambiar({ color: c })}
                    className={cn(
                      "area-tactil h-7 w-7 rounded-full ring-offset-2",
                      d.color === c && "ring-2 ring-ac-tinta",
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                    aria-pressed={d.color === c}
                  />
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Switch
                checked={d.activo}
                onCheckedChange={(v) => cambiar({ activo: v })}
              />{" "}
              Activo (aparece en la agenda y en el sitio de reservas)
            </label>
          </TabsContent>
          <TabsContent value="servicios" className="pt-2">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={todos}
                onCheckedChange={(v) =>
                  cambiar({
                    servicios:
                      v === true ? equipo.servicios.map((s) => s.id) : [],
                  })
                }
              />{" "}
              Todos los servicios
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {equipo.servicios.map((s) => (
                <label
                  key={s.id}
                  className="flex min-h-11 items-center gap-2 rounded-md border border-ac-borde px-3 py-2 text-sm md:min-h-0"
                >
                  <Checkbox
                    checked={d.servicios.includes(s.id)}
                    onCheckedChange={(v) =>
                      cambiar({
                        servicios:
                          v === true
                            ? [...d.servicios, s.id]
                            : d.servicios.filter((x) => x !== s.id),
                      })
                    }
                  />
                  {s.nombre}
                </label>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="horario" className="pt-2">
            <EditorHorario
              valor={d.horario}
              onChange={(horario) => cambiar({ horario })}
              etiquetaActivo="Trabaja"
              referencia={local?.horario}
            />
          </TabsContent>
        </Tabs>
        {error ? <p className="text-sm text-ac-error">{error}</p> : null}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            onClick={guardar}
            disabled={guardando || erroresHorario(d.horario).some(Boolean)}
          >
            {guardando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {d.id ? "Guardar cambios" : "Crear profesional"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProfesionalesVista({ equipo }: { equipo: DatosEquipo }) {
  const [editando, setEditando] = useState<DatosProfesional | null>(null);
  const local = equipo.locales[0];
  const nuevo = (): DatosProfesional => ({
    nombre: "",
    color: COLORES[equipo.profesionales.length % COLORES.length],
    localId: local?.id ?? "",
    servicios: [],
    activo: true,
    horario: local?.horario ?? [],
  });
  const nombreLocal = (id: string) =>
    equipo.locales.find((l) => l.id === id)?.nombre ?? "—";

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditando(nuevo())} data-guia="equipo">
          <Plus className="h-4 w-4" aria-hidden="true" /> Nuevo profesional
        </Button>
      </div>
      {equipo.profesionales.length === 0 ? (
        <Vacio
          icono={UserRound}
          titulo="Todavía no hay profesionales"
          texto="Agrega a quienes atienden para poder asignarles citas."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {equipo.profesionales.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-lg border border-ac-borde bg-ac-papel p-4 shadow-quieta"
            >
              <span
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold text-white"
                style={{ backgroundColor: p.color }}
              >
                {iniciales(p.nombre)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {p.nombre}
                  {!p.activo ? (
                    <span className="ml-2 rounded-full bg-ac-niebla-oscura px-2 py-0.5 text-xs font-medium text-ac-pizarra">
                      Inactivo
                    </span>
                  ) : null}
                </span>
                <span className="block text-[13px] text-ac-pizarra">
                  {nombreLocal(p.localId)} · {p.servicios.length} servicios ·{" "}
                  {p.horario.filter((d) => d.activo).length} días
                </span>
                <NotaProfesional calificacion={p.calificacion} />
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditando(p)}
                aria-label={`Editar a ${p.nombre}`}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {editando ? (
        <Formulario
          equipo={equipo}
          inicial={editando}
          onCerrar={() => setEditando(null)}
        />
      ) : null}
    </>
  );
}
