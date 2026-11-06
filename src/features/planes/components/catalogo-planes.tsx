"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { Loader2, Pencil, Plus, Ticket } from "lucide-react";
import { toast } from "sonner";
import { leerPesos } from "@/features/ventas/lib/venta";
import { Campo } from "@/shared/components/campo";
import { Vacio } from "@/shared/components/vacio";
import { pesos } from "@/shared/lib/formato";
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
import { guardarPlan } from "../actions";
import type { Plan } from "../types";

type ServicioPlan = { id: string; nombre: string; categoria: string };
type Filtro = "activos" | "inactivos" | "todos";

const numero = (t: string) => {
  const n = Number(t.replace(/\D/g, ""));
  return t.trim() === "" || Number.isNaN(n) ? -1 : n;
};

function ModalPlan({
  plan,
  servicios,
  onCerrar,
}: {
  plan: Plan | null;
  servicios: ServicioPlan[];
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(plan?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(plan?.descripcion ?? "");
  const [precio, setPrecio] = useState(plan ? String(plan.precio) : "");
  const [vigencia, setVigencia] = useState(String(plan?.vigenciaDias ?? 30));
  const [sesiones, setSesiones] = useState(
    plan?.sesiones ? String(plan.sesiones) : "",
  );
  const [elegidos, setElegidos] = useState<string[]>(plan?.servicios ?? []);
  const [activo, setActivo] = useState(plan?.activo ?? true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransicionRed();
  const categorias = [...new Set(servicios.map((s) => s.categoria))];

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await guardarPlan({
        id: plan?.id ?? null,
        nombre,
        descripcion,
        precio: leerPesos(precio) ?? -1,
        vigenciaDias: numero(vigencia),
        sesiones: sesiones.trim() ? numero(sesiones) : null,
        servicios: elegidos,
        activo,
      });
      if (!r.ok) return setError(r.error);
      toast.success(plan ? "Plan guardado" : "Plan creado");
      onCerrar();
    });
  }

  const alternar = (id: string, si: boolean) =>
    setElegidos((l) => (si ? [...l, id] : l.filter((x) => x !== id)));

  return (
    <Dialog open onOpenChange={(v) => !v && !guardando && onCerrar()}>
      <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan ? "Editar plan" : "Nuevo plan"}</DialogTitle>
          <DialogDescription>
            Se vende en la caja y queda a nombre del cliente: cada cita que lo
            usa sale en $0 y descuenta del cupo.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          <Campo id="plan-nombre" etiqueta="Nombre" obligatorio>
            <Input
              id="plan-nombre"
              value={nombre}
              maxLength={60}
              autoFocus
              onChange={(e) => setNombre(e.target.value)}
            />
          </Campo>
          <Campo
            id="plan-descripcion"
            etiqueta="Descripción"
            ayuda="Lo que incluye, en una línea"
          >
            <Input
              id="plan-descripcion"
              value={descripcion}
              maxLength={300}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </Campo>
          <div className="grid grid-cols-3 gap-3">
            <Campo id="plan-precio" etiqueta="Precio" obligatorio>
              <Input
                id="plan-precio"
                inputMode="numeric"
                className="cifras"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
              />
            </Campo>
            <Campo id="plan-vigencia" etiqueta="Vale (días)" obligatorio>
              <Input
                id="plan-vigencia"
                inputMode="numeric"
                className="cifras"
                value={vigencia}
                onChange={(e) => setVigencia(e.target.value)}
              />
            </Campo>
            <Campo
              id="plan-sesiones"
              etiqueta="Citas"
              ayuda="Vacío = sin límite"
            >
              <Input
                id="plan-sesiones"
                inputMode="numeric"
                className="cifras"
                value={sesiones}
                onChange={(e) => setSesiones(e.target.value)}
              />
            </Campo>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Servicios que incluye
            </legend>
            <p className="text-xs text-ac-pizarra">
              {elegidos.length
                ? `${elegidos.length} elegidos`
                : "Ninguno elegido: sirve para todos los servicios."}
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
                          <label className="flex min-h-11 items-center gap-2 text-sm md:min-h-0">
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
          {plan ? (
            <label className="flex items-center justify-between gap-3 rounded-md border border-ac-borde px-3 py-2.5 text-sm">
              <span>
                <span className="block font-medium">A la venta</span>
                <span className="text-ac-pizarra">
                  Apagado no sale en la caja; los vendidos siguen valiendo.
                </span>
              </span>
              <Switch
                checked={activo}
                onCheckedChange={setActivo}
                aria-label="A la venta"
              />
            </label>
          ) : null}
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
              {plan ? "Guardar" : "Crear plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function incluye(p: Plan, servicios: ServicioPlan[]) {
  if (!p.servicios.length) return "Todos los servicios";
  const nombres = servicios
    .filter((s) => p.servicios.includes(s.id))
    .map((s) => s.nombre);
  return nombres.length > 3
    ? `${nombres.slice(0, 3).join(", ")} y ${nombres.length - 3} más`
    : nombres.join(", ");
}

/** Administración → Planes: planes y membresías con su cupo, vigencia y servicios (Activos · Inactivos · Todos). */
export function CatalogoPlanes({
  planes,
  servicios,
}: {
  planes: Plan[];
  servicios: ServicioPlan[];
}) {
  const [editando, setEditando] = useState<Plan | "nuevo" | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("activos");
  const lista = planes.filter(
    (p) => filtro === "todos" || p.activo === (filtro === "activos"),
  );
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
          <Plus className="h-4 w-4" aria-hidden="true" /> Nuevo plan
        </Button>
      </div>
      {lista.length === 0 ? (
        <Vacio
          icono={Ticket}
          titulo={planes.length ? "No hay planes aquí" : "Aún no tienes planes"}
          texto="Un plan es un cupo de citas que el cliente paga por adelantado y usa dentro de su vigencia."
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2" aria-label="Planes">
          {lista.map((p) => (
            <li
              key={p.id}
              className={cn(
                "flex items-start gap-3 rounded-lg border border-ac-borde bg-ac-papel p-4 shadow-quieta",
                !p.activo && "opacity-70",
              )}
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ac-laguna-claro text-ac-laguna-hondo">
                <Ticket className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold">{p.nombre}</p>
                {p.descripcion ? (
                  <p className="text-ac-pizarra">{p.descripcion}</p>
                ) : null}
                <p className="cifras mt-1">
                  {pesos(p.precio)} ·{" "}
                  {p.sesiones ? `${p.sesiones} citas` : "citas sin límite"} en{" "}
                  {p.vigenciaDias} días
                </p>
                <p className="text-xs text-ac-pizarra">
                  {incluye(p, servicios)}
                </p>
                <p className="cifras text-xs text-ac-pizarra">
                  {p.activo ? "A la venta" : "No está a la venta"} ·{" "}
                  {p.vendidos} {p.vendidos === 1 ? "vendido" : "vendidos"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditando(p)}
                aria-label={`Editar ${p.nombre}`}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Editar</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
      {editando ? (
        <ModalPlan
          plan={editando === "nuevo" ? null : editando}
          servicios={servicios}
          onCerrar={() => setEditando(null)}
        />
      ) : null}
    </div>
  );
}
