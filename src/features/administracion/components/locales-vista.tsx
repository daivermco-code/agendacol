"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { Clock, Loader2, MapPin, Pencil, Phone, Plus } from "lucide-react";
import { toast } from "sonner";
import { Campo } from "@/shared/components/campo";
import { DIAS } from "@/shared/lib/formato";
import { Button } from "@/shared/ui/button";
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
import { Textarea } from "@/shared/ui/textarea";
import { guardarHorarioLocal, guardarLocal } from "../actions";
import { esquemaLocal, type DatosLocal } from "../schemas";
import type { LocalVista } from "../services/catalogo";
import { EditorHorario, erroresHorario } from "./editor-horario";

function TablaHorario({ local }: { local: LocalVista }) {
  return (
    <table className="mt-3 w-full max-w-md text-sm">
      <thead>
        <tr className="text-left text-xs text-ac-pizarra">
          <th className="py-1 font-medium">Día</th>
          <th className="py-1 font-medium">Apertura</th>
          <th className="py-1 font-medium">Cierre</th>
          <th className="py-1 font-medium">Descanso</th>
        </tr>
      </thead>
      <tbody className="cifras">
        {local.horario.map((d, i) => (
          <tr key={d.dia} className="border-t border-ac-borde">
            <td className="py-1.5 font-medium">{DIAS[i]}</td>
            {d.activo ? (
              <>
                <td>{d.inicio}</td>
                <td>{d.fin}</td>
                <td className="text-ac-pizarra">
                  {d.descanso ? `${d.descansoInicio}–${d.descansoFin}` : "—"}
                </td>
              </>
            ) : (
              <td colSpan={3} className="text-ac-neblina">
                Cerrado
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ModalLocal({
  local,
  descripcion,
  onCerrar,
}: {
  /** null = local nuevo. */
  local: LocalVista | null;
  descripcion: string;
  onCerrar: () => void;
}) {
  const [datos, setDatos] = useState<DatosLocal>(
    local
      ? {
          ...local,
          zonaHoraria: local.zonaHoraria as DatosLocal["zonaHoraria"],
        }
      : {
          id: null,
          nombre: "",
          direccion: "",
          telefono: "",
          aceptaWhatsapp: false,
          correo: "",
          zonaHoraria: "America/Bogota",
          reservasEnLinea: true,
          descripcion,
        },
  );
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransicionRed();
  const cambiar = (c: Partial<DatosLocal>) => setDatos((d) => ({ ...d, ...c }));
  const horaLocal = new Intl.DateTimeFormat("es-CO", {
    timeZone: datos.zonaHoraria,
    timeStyle: "short",
  }).format(new Date());

  function guardar() {
    const p = esquemaLocal.safeParse(datos);
    if (!p.success)
      return setError(p.error.issues[0]?.message ?? "Revisa los datos");
    setError(null);
    iniciar(async () => {
      const r = await guardarLocal(p.data);
      if (r.ok) {
        toast.success(
          local ? "Local guardado" : "Local creado con el horario del primero",
        );
        onCerrar();
      } else toast.error(r.error, { duration: Infinity });
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !guardando && onCerrar()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{local ? "Editar local" : "Nuevo local"}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="datos">
          <TabsList>
            <TabsTrigger value="datos">Datos básicos</TabsTrigger>
            <TabsTrigger value="sitio">Mi sitio web</TabsTrigger>
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
                value={datos.nombre}
                onChange={(e) => cambiar({ nombre: e.target.value })}
              />
            </Campo>
            <Campo
              id="direccion"
              etiqueta="Dirección"
              className="sm:col-span-2"
            >
              <Input
                id="direccion"
                value={datos.direccion}
                onChange={(e) => cambiar({ direccion: e.target.value })}
              />
            </Campo>
            <Campo
              id="telefono"
              etiqueta="Teléfono"
              ayuda="Con indicativo: +57…"
            >
              <Input
                id="telefono"
                inputMode="tel"
                value={datos.telefono}
                onChange={(e) =>
                  cambiar({ telefono: e.target.value.replace(/[\s-]/g, "") })
                }
              />
            </Campo>
            <Campo id="correo" etiqueta="Correo">
              <Input
                id="correo"
                type="email"
                value={datos.correo}
                onChange={(e) => cambiar({ correo: e.target.value })}
              />
            </Campo>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Switch
                checked={datos.aceptaWhatsapp}
                onCheckedChange={(v) => cambiar({ aceptaWhatsapp: v })}
              />
              Este teléfono recibe WhatsApp
            </label>
            <Campo
              id="zona"
              etiqueta="Zona horaria"
              ayuda={`Hora actual allí: ${horaLocal}`}
              className="sm:col-span-2"
            >
              <select
                id="zona"
                value={datos.zonaHoraria}
                onChange={(e) =>
                  cambiar({
                    zonaHoraria: e.target.value as DatosLocal["zonaHoraria"],
                  })
                }
                className="h-11 w-full rounded-md border border-ac-borde bg-ac-papel px-3 md:h-9"
              >
                <option value="America/Bogota">Bogotá (GMT-5)</option>
                <option value="America/Lima">Lima (GMT-5)</option>
                <option value="America/Mexico_City">
                  Ciudad de México (GMT-6)
                </option>
                <option value="America/Santiago">Santiago (GMT-4/-3)</option>
              </select>
            </Campo>
          </TabsContent>
          <TabsContent value="sitio" className="space-y-4 pt-2">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={datos.reservasEnLinea}
                onCheckedChange={(v) => cambiar({ reservasEnLinea: v })}
              />
              Recibir reservas en línea en este local
            </label>
            <Campo
              id="descripcion"
              etiqueta="Descripción del negocio"
              ayuda="Aparece en la portada del sitio de reservas."
            >
              <Textarea
                id="descripcion"
                rows={4}
                value={datos.descripcion}
                onChange={(e) => cambiar({ descripcion: e.target.value })}
              />
            </Campo>
          </TabsContent>
        </Tabs>
        {error ? <p className="text-sm text-ac-error">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModalHorario({
  local,
  onCerrar,
}: {
  local: LocalVista;
  onCerrar: () => void;
}) {
  const [dias, setDias] = useState(local.horario);
  const [guardando, iniciar] = useTransicionRed();
  const hayErrores = erroresHorario(dias).some(Boolean);

  function guardar() {
    iniciar(async () => {
      const r = await guardarHorarioLocal(local.id, dias);
      if (r.ok) {
        toast.success("Horario guardado");
        onCerrar();
      } else toast.error(r.error, { duration: Infinity });
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !guardando && onCerrar()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Horario de {local.nombre}</DialogTitle>
        </DialogHeader>
        <EditorHorario valor={dias} onChange={setDias} />
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando || hayErrores}>
            {guardando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            Guardar horario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LocalesVista({ locales }: { locales: LocalVista[] }) {
  const [verHorario, setVerHorario] = useState<string | null>(
    locales[0]?.id ?? null,
  );
  const [editando, setEditando] = useState<{
    id: string;
    que: "datos" | "horario";
  } | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const local = locales.find((l) => l.id === editando?.id);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setNuevo(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Nuevo local
        </Button>
      </div>
      {locales.map((l, i) => (
        <article
          key={l.id}
          className="rounded-lg border border-ac-borde bg-ac-papel p-4 shadow-quieta sm:p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">{l.nombre}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-ac-pizarra">
                <MapPin className="h-4 w-4" aria-hidden="true" />{" "}
                {l.direccion || "Sin dirección"}
              </p>
              {l.telefono ? (
                <p className="mt-0.5 flex items-center gap-1.5 text-ac-pizarra">
                  <Phone className="h-4 w-4" aria-hidden="true" /> {l.telefono}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVerHorario(verHorario === l.id ? null : l.id)}
                aria-expanded={verHorario === l.id}
              >
                <Clock className="h-4 w-4" aria-hidden="true" />{" "}
                {verHorario === l.id ? "Ocultar horario" : "Ver horario"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label={`Editar horario de ${l.nombre}`}
                data-guia={i === 0 ? "horario" : undefined}
                onClick={() => setEditando({ id: l.id, que: "horario" })}
              >
                Editar horario
              </Button>
              <Button
                size="sm"
                aria-label={`Editar ${l.nombre}`}
                onClick={() => setEditando({ id: l.id, que: "datos" })}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" /> Editar
              </Button>
            </div>
          </div>
          {verHorario === l.id ? <TablaHorario local={l} /> : null}
        </article>
      ))}
      {local && editando?.que === "datos" ? (
        <ModalLocal
          key={local.id}
          local={local}
          descripcion={local.descripcion}
          onCerrar={() => setEditando(null)}
        />
      ) : null}
      {nuevo ? (
        <ModalLocal
          local={null}
          descripcion={locales[0]?.descripcion ?? ""}
          onCerrar={() => setNuevo(false)}
        />
      ) : null}
      {local && editando?.que === "horario" ? (
        <ModalHorario
          key={local.id}
          local={local}
          onCerrar={() => setEditando(null)}
        />
      ) : null}
    </div>
  );
}
