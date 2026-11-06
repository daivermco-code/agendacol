"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { Armchair, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Campo } from "@/shared/components/campo";
import { Vacio } from "@/shared/components/vacio";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { CONTROL } from "@/features/citas/components/campos-reserva";
import { guardarRecurso } from "../actions";
import type { LocalRecurso, Recurso, ServicioRecurso } from "../types";

type Filtro = "activos" | "inactivos" | "todos";

function ModalRecurso({
  recurso,
  locales,
  servicios,
  onCerrar,
}: {
  recurso: Recurso | null;
  locales: LocalRecurso[];
  servicios: ServicioRecurso[];
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(recurso?.nombre ?? "");
  const [localId, setLocalId] = useState(
    recurso?.localId ?? locales[0]?.id ?? "",
  );
  const [descripcion, setDescripcion] = useState(recurso?.descripcion ?? "");
  const [elegidos, setElegidos] = useState<string[]>(recurso?.servicios ?? []);
  const [activo, setActivo] = useState(recurso?.activo ?? true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransicionRed();
  const categorias = [...new Set(servicios.map((s) => s.categoria))];

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await guardarRecurso({
        id: recurso?.id ?? null,
        localId,
        nombre,
        descripcion,
        activo,
        servicios: elegidos,
      });
      if (!r.ok) return setError(r.error);
      toast.success(recurso ? "Recurso guardado" : "Recurso creado");
      onCerrar();
    });
  }
  const alternar = (id: string, si: boolean) =>
    setElegidos((l) => (si ? [...l, id] : l.filter((x) => x !== id)));

  return (
    <Dialog open onOpenChange={(v) => !v && !guardando && onCerrar()}>
      <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {recurso ? "Editar recurso" : "Nuevo recurso"}
          </DialogTitle>
          <DialogDescription>
            Una sala, silla o equipo que solo atiende una cita a la vez. Al
            agendar un servicio que lo usa se asigna el primero libre.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          <Campo id="recurso-nombre" etiqueta="Nombre" obligatorio>
            <Input
              id="recurso-nombre"
              value={nombre}
              maxLength={60}
              autoFocus
              placeholder="Cabina 1"
              onChange={(e) => setNombre(e.target.value)}
            />
          </Campo>
          {locales.length > 1 ? (
            <Campo id="recurso-local" etiqueta="Local" obligatorio>
              <select
                id="recurso-local"
                className={CONTROL}
                value={localId}
                onChange={(e) => setLocalId(e.target.value)}
              >
                {locales.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          ) : null}
          <Campo id="recurso-descripcion" etiqueta="Descripción">
            <Input
              id="recurso-descripcion"
              value={descripcion}
              maxLength={200}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </Campo>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Servicios que lo usan
            </legend>
            <p className="text-xs text-ac-pizarra">
              {elegidos.length
                ? `${elegidos.length} elegidos`
                : "Ninguno: solo se asigna a mano en la reserva."}
            </p>
            <div className="max-h-56 space-y-3 overflow-y-auto rounded-md border border-ac-borde p-3">
              {categorias.map((c) => (
                <div key={c}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ac-pizarra">
                    {c}
                  </p>
                  <ul className="grid gap-1 sm:grid-cols-2">
                    {servicios
                      .filter((s) => s.categoria === c)
                      .map((s) => (
                        <li key={s.id}>
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={elegidos.includes(s.id)}
                              onCheckedChange={(v) =>
                                alternar(s.id, v === true)
                              }
                            />
                            {s.nombre}
                          </label>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center justify-between gap-3 rounded-md border border-ac-borde px-3 py-2.5 text-sm">
            <span>
              <span className="block font-medium">Activo</span>
              <span className="text-ac-pizarra">
                Apagado no se asigna a citas nuevas.
              </span>
            </span>
            <Switch
              checked={activo}
              onCheckedChange={setActivo}
              aria-label="Activo"
            />
          </label>
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
              {recurso ? "Guardar" : "Crear recurso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function nombresServicios(r: Recurso, servicios: ServicioRecurso[]) {
  const nombres = servicios
    .filter((s) => r.servicios.includes(s.id))
    .map((s) => s.nombre);
  if (!nombres.length) return "Ningún servicio lo pide";
  return nombres.length > 3
    ? `${nombres.slice(0, 3).join(", ")} y ${nombres.length - 3} más`
    : nombres.join(", ");
}

/** Administración → Recursos: salas, sillas y equipos por local (Activos · Inactivos · Todos). */
export function RecursosVista({
  recursos,
  locales,
  servicios,
}: {
  recursos: Recurso[];
  locales: LocalRecurso[];
  servicios: ServicioRecurso[];
}) {
  const [editando, setEditando] = useState<Recurso | "nuevo" | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("activos");
  const lista = recursos.filter(
    (r) => filtro === "todos" || r.activo === (filtro === "activos"),
  );
  const grupos = locales
    .map((l) => ({ ...l, recursos: lista.filter((r) => r.localId === l.id) }))
    .filter((g) => g.recursos.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Mostrar">
          {(["activos", "inactivos", "todos"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filtro === f}
              onClick={() => setFiltro(f)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm capitalize min-h-11 md:min-h-0",
                filtro === f
                  ? "border-ac-laguna bg-ac-laguna-claro font-medium text-ac-laguna-hondo"
                  : "border-ac-borde bg-ac-papel text-ac-pizarra hover:bg-ac-niebla",
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <Button className="ml-auto" onClick={() => setEditando("nuevo")}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Nuevo recurso
        </Button>
      </div>
      {grupos.length === 0 ? (
        <Vacio
          icono={Armchair}
          titulo={
            recursos.length ? "No hay recursos aquí" : "Aún no tienes recursos"
          }
          texto="Una cabina, una silla o un equipo que solo puede atender una cita a la vez."
        />
      ) : (
        grupos.map((g) => (
          <section key={g.id} aria-label={g.nombre} className="space-y-2">
            {locales.length > 1 ? (
              <h2 className="font-semibold">{g.nombre}</h2>
            ) : null}
            <ul className="grid gap-3 lg:grid-cols-2">
              {g.recursos.map((r) => (
                <li
                  key={r.id}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border border-ac-borde bg-ac-papel p-4 shadow-quieta",
                    !r.activo && "opacity-70",
                  )}
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ac-laguna-claro text-ac-laguna-hondo">
                    <Armchair className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold">{r.nombre}</p>
                    {r.descripcion ? (
                      <p className="text-ac-pizarra">{r.descripcion}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-ac-pizarra">
                      {nombresServicios(r, servicios)}
                    </p>
                    <p className="cifras text-xs text-ac-pizarra">
                      {r.activo ? "Activo" : "Inactivo"} · {r.proximas}{" "}
                      {r.proximas === 1 ? "cita próxima" : "citas próximas"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditando(r)}
                    aria-label={`Editar ${r.nombre}`}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Editar</span>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      {editando ? (
        <ModalRecurso
          recurso={editando === "nuevo" ? null : editando}
          locales={locales}
          servicios={servicios}
          onCerrar={() => setEditando(null)}
        />
      ) : null}
    </div>
  );
}
