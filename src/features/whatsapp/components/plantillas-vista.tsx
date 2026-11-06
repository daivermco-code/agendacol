"use client";

import { useRef, useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { Loader2, MessageCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirmar } from "@/shared/components/confirmar";
import { Campo } from "@/shared/components/campo";
import { Vacio } from "@/shared/components/vacio";
import { cn } from "@/shared/lib/utils";
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
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import { borrarPlantilla, guardarPlantilla } from "../actions";
import { EJEMPLO, llenarPlantilla, VARIABLES } from "../lib/plantillas";
import type { Plantilla } from "../types";

function Burbuja({ texto }: { texto: string }) {
  return (
    <p className="whitespace-pre-line rounded-lg rounded-tl-none bg-ac-exito-fondo px-3 py-2 text-sm text-ac-tinta">
      {texto}
    </p>
  );
}

function ModalPlantilla({
  plantilla,
  onCerrar,
}: {
  plantilla: Plantilla | null;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(plantilla?.nombre ?? "");
  const [cuerpo, setCuerpo] = useState(plantilla?.cuerpo ?? "Hola {cliente}, ");
  const [activo, setActivo] = useState(plantilla?.activo ?? true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransicionRed();
  const area = useRef<HTMLTextAreaElement>(null);

  /** Pone la variable donde está el cursor (o al final). */
  function insertar(clave: string) {
    const el = area.current;
    const texto = `{${clave}}`;
    const ini = el?.selectionStart ?? cuerpo.length;
    const fin = el?.selectionEnd ?? cuerpo.length;
    setCuerpo(cuerpo.slice(0, ini) + texto + cuerpo.slice(fin));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(ini + texto.length, ini + texto.length);
    });
  }

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await guardarPlantilla({
        id: plantilla?.id ?? null,
        nombre,
        cuerpo,
        activo,
      });
      if (!r.ok) return setError(r.error);
      toast.success(plantilla ? "Plantilla guardada" : "Plantilla creada");
      onCerrar();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !guardando && onCerrar()}>
      <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {plantilla ? "Editar plantilla" : "Nueva plantilla"}
          </DialogTitle>
          <DialogDescription>
            Se manda desde la ficha de una reserva con sus datos puestos. En la
            demo llega al buzón.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          <Campo id="plantilla-nombre" etiqueta="Nombre" obligatorio>
            <Input
              id="plantilla-nombre"
              value={nombre}
              maxLength={60}
              autoFocus
              placeholder="Confirmar asistencia"
              onChange={(e) => setNombre(e.target.value)}
            />
          </Campo>
          <Campo id="plantilla-cuerpo" etiqueta="Mensaje" obligatorio>
            <Textarea
              id="plantilla-cuerpo"
              ref={area}
              rows={5}
              maxLength={600}
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
            />
          </Campo>
          <div
            className="-mt-2 flex flex-wrap gap-1.5"
            aria-label="Agregar un dato"
          >
            {VARIABLES.map((v) => (
              <button
                key={v.clave}
                type="button"
                onClick={() => insertar(v.clave)}
                className="min-h-11 rounded-full border border-ac-borde bg-ac-papel px-2.5 py-1 text-xs hover:bg-ac-niebla md:min-h-0"
              >
                + {v.nombre}
              </button>
            ))}
          </div>
          <section aria-label="Vista previa" className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-ac-pizarra">
              Así se ve con una reserva de ejemplo
            </p>
            <Burbuja texto={llenarPlantilla(cuerpo, EJEMPLO)} />
          </section>
          <label className="flex items-center justify-between gap-3 rounded-md border border-ac-borde px-3 py-2.5 text-sm">
            <span>
              <span className="block font-medium">Activa</span>
              <span className="text-ac-pizarra">
                Apagada no sale en la ficha de las reservas.
              </span>
            </span>
            <Switch
              checked={activo}
              onCheckedChange={setActivo}
              aria-label="Activa"
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
              {plantilla ? "Guardar" : "Crear plantilla"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Administración → WhatsApp: plantillas de mensajes para mandar desde una reserva. */
export function PlantillasVista({ plantillas }: { plantillas: Plantilla[] }) {
  const [editando, setEditando] = useState<Plantilla | "nueva" | null>(null);
  const [dialogo, confirmar] = useConfirmar();
  const [, iniciar] = useTransicionRed();

  async function borrar(t: Plantilla) {
    const ok = await confirmar({
      titulo: `¿Borrar la plantilla ${t.nombre}?`,
      texto: "Los mensajes ya enviados con ella siguen en el buzón.",
      aceptar: "Borrar",
      peligro: true,
    });
    if (!ok) return;
    iniciar(async () => {
      const r = await borrarPlantilla(t.id);
      if (r.ok) toast.success("Plantilla borrada");
      else toast.error(r.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditando("nueva")}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Nueva plantilla
        </Button>
      </div>
      {plantillas.length === 0 ? (
        <Vacio
          icono={MessageCircle}
          titulo="Aún no tienes plantillas"
          texto="Escribe los mensajes que más mandas (confirmar, vamos tarde, gracias por venir) y mándalos con un clic."
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {plantillas.map((t) => (
            <li
              key={t.id}
              className={cn(
                "space-y-3 rounded-lg border border-ac-borde bg-ac-papel p-4 shadow-quieta",
                !t.activo && "opacity-70",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t.nombre}</p>
                  <p className="text-xs text-ac-pizarra">
                    {t.activo ? "Activa" : "Apagada"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditando(t)}
                  aria-label={`Editar ${t.nombre}`}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => borrar(t)}
                  aria-label={`Borrar ${t.nombre}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              <Burbuja texto={llenarPlantilla(t.cuerpo, EJEMPLO)} />
            </li>
          ))}
        </ul>
      )}
      {editando ? (
        <ModalPlantilla
          plantilla={editando === "nueva" ? null : editando}
          onCerrar={() => setEditando(null)}
        />
      ) : null}
      {dialogo}
    </div>
  );
}
