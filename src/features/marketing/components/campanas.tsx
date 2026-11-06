"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import Link from "next/link";
import { Inbox, Loader2, Mail, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirmar } from "@/shared/components/confirmar";
import { Campo } from "@/shared/components/campo";
import { Vacio } from "@/shared/components/vacio";
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
import { Textarea } from "@/shared/ui/textarea";
import { CONTROL } from "@/features/citas/components/campos-reserva";
import { borrarCampana, enviarCampana, guardarCampana } from "../actions";
import { conNombre } from "../lib/audiencias";
import type { Audiencia, Campana, Conteo } from "../types";
import { TextoConteo } from "./audiencias";

const FECHA = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  dateStyle: "medium",
  timeStyle: "short",
});

interface Destinos {
  audiencias: Audiencia[];
  todos: Conteo;
}

const conteoDe = (d: Destinos, audienciaId: string | null) =>
  audienciaId
    ? (d.audiencias.find((a) => a.id === audienciaId)?.conteo ?? null)
    : d.todos;
const nombreDe = (d: Destinos, audienciaId: string | null) =>
  audienciaId
    ? (d.audiencias.find((a) => a.id === audienciaId)?.nombre ??
      "Audiencia borrada")
    : "Todos los clientes";

function ModalCampana({
  campana,
  destinos,
  onCerrar,
}: {
  campana: Campana | null;
  destinos: Destinos;
  onCerrar: () => void;
}) {
  const [audienciaId, setAudienciaId] = useState(campana?.audienciaId ?? "");
  const [asunto, setAsunto] = useState(campana?.asunto ?? "");
  const [cuerpo, setCuerpo] = useState(campana?.cuerpo ?? "Hola {nombre}, ");
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransicionRed();
  const conteo = conteoDe(destinos, audienciaId || null);

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await guardarCampana({
        id: campana?.id ?? null,
        audienciaId: audienciaId || null,
        asunto,
        cuerpo,
      });
      if (!r.ok) return setError(r.error);
      toast.success("Borrador guardado");
      onCerrar();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !guardando && onCerrar()}>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {campana ? "Editar campaña" : "Nueva campaña"}
          </DialogTitle>
          <DialogDescription>
            Se guarda como borrador. Al enviarla, cada correo llega al buzón de
            la demo con el nombre del cliente.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          <div className="space-y-4">
            <Campo id="campana-audiencia" etiqueta="Para">
              <select
                id="campana-audiencia"
                className={CONTROL}
                value={audienciaId}
                onChange={(e) => setAudienciaId(e.target.value)}
              >
                <option value="">Todos los clientes</option>
                {destinos.audiencias.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            {conteo ? (
              <p className="-mt-2 text-xs text-ac-pizarra">
                <TextoConteo conteo={conteo} />
              </p>
            ) : null}
            <Campo id="campana-asunto" etiqueta="Asunto" obligatorio>
              <Input
                id="campana-asunto"
                value={asunto}
                maxLength={120}
                autoFocus
                onChange={(e) => setAsunto(e.target.value)}
              />
            </Campo>
            <Campo
              id="campana-cuerpo"
              etiqueta="Mensaje"
              obligatorio
              ayuda="{nombre} se cambia por el nombre de cada cliente."
            >
              <Textarea
                id="campana-cuerpo"
                rows={7}
                maxLength={2000}
                value={cuerpo}
                onChange={(e) => setCuerpo(e.target.value)}
              />
            </Campo>
          </div>
          <section
            aria-label="Vista previa"
            className="rounded-lg border border-ac-borde bg-ac-niebla p-4 text-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-ac-pizarra">
              Así le llega a Ana
            </p>
            <p className="mt-2 font-semibold">
              {conNombre(asunto, "Ana") || "Sin asunto"}
            </p>
            <p className="mt-2 whitespace-pre-line">
              {conNombre(cuerpo, "Ana")}
            </p>
          </section>
          {error ? (
            <p role="alert" className="text-sm text-ac-error md:col-span-2">
              {error}
            </p>
          ) : null}
          <DialogFooter className="md:col-span-2">
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
              Guardar borrador
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Pestaña Campañas: borradores (editar, enviar, borrar) y enviadas (con su enlace al buzón). */
export function Campanas({
  campanas,
  destinos,
  quedan,
}: {
  campanas: Campana[];
  destinos: Destinos;
  quedan: number;
}) {
  const [editando, setEditando] = useState<Campana | "nueva" | null>(null);
  const [dialogo, confirmar] = useConfirmar();
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [, iniciar] = useTransicionRed();

  async function enviar(c: Campana) {
    const conteo = conteoDe(destinos, c.audienciaId);
    const n = conteo?.reciben ?? 0;
    const ok = await confirmar({
      titulo: `¿Enviar "${c.asunto}"?`,
      texto: `Le llega a ${n} ${n === 1 ? "cliente" : "clientes"} de ${nombreDe(destinos, c.audienciaId)}. Te quedan ${quedan} envíos este mes. Ya enviada no se puede editar.`,
      aceptar: "Enviar",
    });
    if (!ok) return;
    setOcupada(c.id);
    iniciar(async () => {
      const r = await enviarCampana(c.id);
      setOcupada(null);
      if (!r.ok) return void toast.error(r.error);
      toast.success(
        `Campaña enviada a ${r.datos.destinatarios} clientes. Mírala en el buzón.`,
      );
    });
  }

  async function borrar(c: Campana) {
    const ok = await confirmar({
      titulo: `¿Borrar el borrador "${c.asunto}"?`,
      aceptar: "Borrar",
      peligro: true,
    });
    if (!ok) return;
    iniciar(async () => {
      const r = await borrarCampana(c.id);
      if (r.ok) toast.success("Borrador borrado");
      else toast.error(r.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setEditando("nueva")}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Nueva campaña
        </Button>
      </div>
      {campanas.length === 0 ? (
        <Vacio
          icono={Mail}
          titulo="Aún no has enviado campañas"
          texto="Escribe un correo para todos tus clientes o para una audiencia; en la demo llega al buzón."
        />
      ) : (
        <ul className="overflow-hidden rounded-lg border border-ac-borde bg-ac-papel shadow-quieta">
          {campanas.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-3 border-b border-ac-borde px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1 basis-full text-sm sm:basis-auto">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{c.asunto}</span>
                  <span
                    className={
                      c.estado === "enviada"
                        ? "rounded-full bg-ac-exito-fondo px-2 py-0.5 text-xs text-ac-exito"
                        : "rounded-full bg-ac-niebla-oscura px-2 py-0.5 text-xs text-ac-pizarra"
                    }
                  >
                    {c.estado === "enviada" ? "Enviada" : "Borrador"}
                  </span>
                </p>
                <p className="cifras text-xs text-ac-pizarra">
                  {nombreDe(destinos, c.audienciaId)} ·{" "}
                  {c.estado === "enviada" && c.enviadaAt
                    ? `${c.destinatarios ?? 0} correos el ${FECHA.format(new Date(c.enviadaAt))}`
                    : `creada el ${FECHA.format(new Date(c.creada))}`}
                </p>
              </div>
              {c.estado === "enviada" ? (
                <Link
                  href={`/demo/buzon?campana=${c.id}`}
                  className="inline-flex h-11 md:h-9 items-center gap-2 rounded-md border border-ac-borde px-3 text-sm hover:bg-ac-niebla"
                >
                  <Inbox className="h-4 w-4" aria-hidden="true" /> Ver en el
                  buzón
                </Link>
              ) : (
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditando(c)}
                    aria-label={`Editar ${c.asunto}`}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => borrar(c)}
                    aria-label={`Borrar ${c.asunto}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => enviar(c)}
                    disabled={ocupada === c.id}
                  >
                    {ocupada === c.id ? (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Send className="h-4 w-4" aria-hidden="true" />
                    )}
                    Enviar
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {editando ? (
        <ModalCampana
          campana={editando === "nueva" ? null : editando}
          destinos={destinos}
          onCerrar={() => setEditando(null)}
        />
      ) : null}
      {dialogo}
    </div>
  );
}
