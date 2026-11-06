"use client";

import { useEffect, useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
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
import { CONTROL } from "@/features/citas/components/campos-reserva";
import { borrarAudiencia, contarAudiencia, guardarAudiencia } from "../actions";
import {
  describirFiltro,
  MESES,
  NUEVOS,
  SIN_VENIR,
  type FiltroAudiencia,
} from "../lib/audiencias";
import type { Audiencia, Campana, Conteo, ServicioFiltro } from "../types";

const numero = new Intl.NumberFormat("es-CO");

/** "34 de 41 reciben el correo · 4 sin correo · 3 suprimidos" */
export function TextoConteo({ conteo }: { conteo: Conteo }) {
  const extra = [
    conteo.sinCorreo ? `${conteo.sinCorreo} sin correo` : null,
    conteo.suprimidos
      ? `${conteo.suprimidos} ${conteo.suprimidos === 1 ? "suprimido" : "suprimidos"}`
      : null,
  ].filter(Boolean);
  return (
    <span className="cifras">
      {numero.format(conteo.reciben)} de {numero.format(conteo.total)} reciben
      el correo{extra.length ? ` · ${extra.join(" · ")}` : ""}
    </span>
  );
}

/** Cambia una clave del filtro según su <select>: "" la quita; las de números se guardan como número. */
function poner(
  f: FiltroAudiencia,
  clave: keyof FiltroAudiencia,
  valor: string,
): FiltroAudiencia {
  const nuevo: Record<string, string | number> = { ...f };
  if (valor === "") delete nuevo[clave];
  else
    nuevo[clave] =
      clave === "genero" || clave === "servicioId" ? valor : Number(valor);
  return nuevo as FiltroAudiencia;
}

function CamposFiltro({
  filtro,
  servicios,
  onCambio,
}: {
  filtro: FiltroAudiencia;
  servicios: ServicioFiltro[];
  onCambio: (f: FiltroAudiencia) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo id="filtro-genero" etiqueta="Género">
        <select
          id="filtro-genero"
          className={CONTROL}
          value={filtro.genero ?? ""}
          onChange={(e) => onCambio(poner(filtro, "genero", e.target.value))}
        >
          <option value="">Cualquiera</option>
          <option value="femenino">Mujeres</option>
          <option value="masculino">Hombres</option>
          <option value="otro">Otro</option>
        </select>
      </Campo>
      <Campo id="filtro-cumple" etiqueta="Cumpleaños">
        <select
          id="filtro-cumple"
          className={CONTROL}
          value={filtro.cumpleMes ?? ""}
          onChange={(e) => onCambio(poner(filtro, "cumpleMes", e.target.value))}
        >
          <option value="">Cualquier mes</option>
          <option value="0">El mes en curso</option>
          {MESES.map((m, i) => (
            <option key={m} value={i + 1}>
              En {m}
            </option>
          ))}
        </select>
      </Campo>
      <Campo id="filtro-servicio" etiqueta="Han tomado">
        <select
          id="filtro-servicio"
          className={CONTROL}
          value={filtro.servicioId ?? ""}
          onChange={(e) =>
            onCambio(poner(filtro, "servicioId", e.target.value))
          }
        >
          <option value="">Cualquier servicio</option>
          {servicios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <Campo id="filtro-sin-venir" etiqueta="No vienen hace">
        <select
          id="filtro-sin-venir"
          className={CONTROL}
          value={filtro.sinVenirDias ?? ""}
          onChange={(e) =>
            onCambio(poner(filtro, "sinVenirDias", e.target.value))
          }
        >
          <option value="">Sin importar</option>
          {SIN_VENIR.map((t) => (
            <option key={t.dias} value={t.dias}>
              {t.nombre} o más
            </option>
          ))}
        </select>
      </Campo>
      <Campo
        id="filtro-nuevos"
        etiqueta="Clientes nuevos"
        className="sm:col-span-2"
      >
        <select
          id="filtro-nuevos"
          className={CONTROL}
          value={filtro.nuevosDias ?? ""}
          onChange={(e) =>
            onCambio(poner(filtro, "nuevosDias", e.target.value))
          }
        >
          <option value="">Sin importar cuándo llegaron</option>
          {NUEVOS.map((t) => (
            <option key={t.dias} value={t.dias}>
              Llegaron {t.nombre}
            </option>
          ))}
        </select>
      </Campo>
    </div>
  );
}

function ModalAudiencia({
  audiencia,
  servicios,
  onCerrar,
}: {
  audiencia: Audiencia | null;
  servicios: ServicioFiltro[];
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(audiencia?.nombre ?? "");
  const [filtro, setFiltro] = useState<FiltroAudiencia>(
    audiencia?.filtro ?? {},
  );
  const [conteo, setConteo] = useState<Conteo | null>(
    audiencia?.conteo ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransicionRed();

  useEffect(() => {
    let vigente = true;
    const t = setTimeout(async () => {
      const r = await contarAudiencia(filtro);
      if (vigente && r.ok) setConteo(r.datos);
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [filtro]);

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await guardarAudiencia({
        id: audiencia?.id ?? null,
        nombre,
        filtro,
      });
      if (!r.ok) return setError(r.error);
      toast.success(audiencia ? "Audiencia guardada" : "Audiencia creada");
      onCerrar();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !guardando && onCerrar()}>
      <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {audiencia ? "Editar audiencia" : "Nueva audiencia"}
          </DialogTitle>
          <DialogDescription>
            Un filtro guardado de clientes. Se vuelve a calcular cada vez que
            envías una campaña.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          <Campo id="audiencia-nombre" etiqueta="Nombre" obligatorio>
            <Input
              id="audiencia-nombre"
              value={nombre}
              maxLength={60}
              autoFocus
              placeholder="Clientas de uñas"
              onChange={(e) => setNombre(e.target.value)}
            />
          </Campo>
          <CamposFiltro
            filtro={filtro}
            servicios={servicios}
            onCambio={setFiltro}
          />
          <p
            className="rounded-md bg-ac-niebla px-3 py-2 text-sm"
            aria-live="polite"
          >
            <span className="font-medium">
              {describirFiltro(filtro, servicios)}
            </span>
            <br />
            {conteo ? <TextoConteo conteo={conteo} /> : "Contando…"}
          </p>
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
              {audiencia ? "Guardar" : "Crear audiencia"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Pestaña Audiencias: filtros guardados de clientes con cuántos recibirían un correo hoy. */
export function Audiencias({
  audiencias,
  campanas,
  servicios,
}: {
  audiencias: Audiencia[];
  campanas: Campana[];
  servicios: ServicioFiltro[];
}) {
  const [editando, setEditando] = useState<Audiencia | "nueva" | null>(null);
  const [dialogo, confirmar] = useConfirmar();
  const [, iniciar] = useTransicionRed();

  async function borrar(a: Audiencia) {
    const borradores = campanas.filter(
      (c) => c.estado === "borrador" && c.audienciaId === a.id,
    ).length;
    const ok = await confirmar({
      titulo: `¿Borrar la audiencia ${a.nombre}?`,
      texto: borradores
        ? `${borradores === 1 ? "Un borrador la usa y pasará" : `${borradores} borradores la usan y pasarán`} a enviarse a todos los clientes.`
        : "Las campañas ya enviadas no cambian.",
      aceptar: "Borrar",
      peligro: true,
    });
    if (!ok) return;
    iniciar(async () => {
      const r = await borrarAudiencia(a.id);
      if (r.ok) toast.success("Audiencia borrada");
      else toast.error(r.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setEditando("nueva")}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Nueva audiencia
        </Button>
      </div>
      {audiencias.length === 0 ? (
        <Vacio
          icono={Users}
          titulo="Aún no tienes audiencias"
          texto="Guarda un filtro de clientes (por ejemplo, los que cumplen años este mes) para mandarles campañas."
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {audiencias.map((a) => (
            <li
              key={a.id}
              className="flex items-start gap-3 rounded-lg border border-ac-borde bg-ac-papel p-4 shadow-quieta"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ac-laguna-claro text-ac-laguna-hondo">
                <Users className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold">{a.nombre}</p>
                <p className="text-ac-pizarra">
                  {describirFiltro(a.filtro, servicios)}
                </p>
                <p className="mt-1 text-xs text-ac-pizarra">
                  <TextoConteo conteo={a.conteo} />
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditando(a)}
                  aria-label={`Editar ${a.nombre}`}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => borrar(a)}
                  aria-label={`Borrar ${a.nombre}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editando ? (
        <ModalAudiencia
          audiencia={editando === "nueva" ? null : editando}
          servicios={servicios}
          onCerrar={() => setEditando(null)}
        />
      ) : null}
      {dialogo}
    </div>
  );
}
