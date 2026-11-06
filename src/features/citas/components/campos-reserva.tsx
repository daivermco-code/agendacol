"use client";

import { useRef, useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { Campo } from "@/shared/components/campo";
import { useEsCelular } from "@/shared/hooks/use-es-celular";
import { duracion, pesos } from "@/shared/lib/formato";
import { cn } from "@/shared/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/accordion";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { BuscadorClientes } from "@/features/clientes/components/buscador-clientes";
import type { ClienteResumen } from "@/features/clientes/schemas";
import type { BaseAgenda } from "@/features/agenda/types";
import { horaFin, serviciosDe, type FormReserva } from "../lib/reserva";
import type { RevisionFecha } from "../types";
import {
  BotonBuscarCliente,
  HojaElegirCliente,
  SelectorServicio,
} from "./selectores-hoja";
import { SerieReserva } from "./serie-reserva";
import { TarjetaCliente } from "./tarjeta-cliente";

export const CONTROL =
  "h-11 w-full md:h-9 rounded-md border border-ac-borde bg-ac-papel px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-foco disabled:cursor-not-allowed disabled:bg-ac-niebla disabled:text-ac-neblina aria-[invalid=true]:border-ac-error";
const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTOS = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, "0"),
);

export type Errores = Partial<Record<string, string>>;

/** Hora y minutos de 24 h, de 1 en 1 (el reloj del navegador saldría en "a. m./p. m."). */
export function SelectorHora({
  id,
  valor,
  nombre = "Hora",
  onCambio,
}: {
  id?: string;
  valor: string;
  nombre?: string;
  onCambio: (hora: string) => void;
}) {
  const [hh = "00", mm = "00"] = valor.split(":");
  return (
    <div className="flex items-center gap-1">
      <select
        id={id}
        aria-label={nombre}
        className={cn(CONTROL, "w-16")}
        value={hh}
        onChange={(e) => onCambio(`${e.target.value}:${mm}`)}
      >
        {HORAS.map((h) => (
          <option key={h}>{h}</option>
        ))}
      </select>
      <span aria-hidden="true">:</span>
      <select
        aria-label={`Minutos de ${nombre.toLowerCase()}`}
        className={cn(CONTROL, "w-16")}
        value={mm}
        onChange={(e) => onCambio(`${hh}:${e.target.value}`)}
      >
        {MINUTOS.map((m) => (
          <option key={m}>{m}</option>
        ))}
      </select>
    </div>
  );
}

interface Props {
  f: FormReserva;
  cambiar: (c: Partial<FormReserva>) => void;
  base: BaseAgenda;
  localId: string;
  errores: Errores;
  revision: RevisionFecha[] | null;
  revisando: boolean;
  onNuevoCliente: (texto: string) => void;
  onEditarCliente: () => void;
}

const aElegido = (c: ClienteResumen) => ({
  id: c.id,
  nombre: `${c.nombre} ${c.apellido}`,
  correo: c.correo,
  telefono: c.telefono,
  creado: c.creado,
});

/** Campos de la ventana de reserva en el orden de flujos.md §3. */
export function CamposReserva(p: Props) {
  const { f, cambiar, errores } = p;
  // En el celular, cliente y servicio se eligen en una hoja desde abajo (T-12.4).
  const celular = useEsCelular();
  const [hojaCliente, setHojaCliente] = useState(false);
  const zonaCliente = useRef<HTMLDivElement>(null);
  const profesionales = p.base.profesionales.filter(
    (x) => x.activo && x.localId === p.localId,
  );
  const servicios = serviciosDe(p.base.servicios, f.profesionalId);
  const categorias = [...new Set(servicios.map((s) => s.categoria))];
  const fin = horaFin(f.hora, f.duracionMin);
  const bloqueado = Boolean(f.id) && f.profesionalFijo;
  const recursos = p.base.recursos.filter((r) => r.localId === p.localId);
  const usaRecurso = Boolean(
    p.base.servicios.find((s) => s.id === f.servicioId)?.recursos.length,
  );

  function elegirProfesional(id: string) {
    const sigue = serviciosDe(p.base.servicios, id).some(
      (s) => s.id === f.servicioId,
    );
    cambiar(
      sigue
        ? { profesionalId: id }
        : { profesionalId: id, servicioId: "", duracionMin: 0 },
    );
  }
  function elegirServicio(id: string) {
    const s = p.base.servicios.find((x) => x.id === id);
    cambiar(
      s
        ? { servicioId: id, duracionMin: s.duracionMin, precio: s.precio }
        : { servicioId: "" },
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <Campo
          id="reserva-fecha"
          etiqueta="Fecha"
          obligatorio
          error={errores.fecha}
        >
          <Input
            id="reserva-fecha"
            type="date"
            value={f.fecha}
            onChange={(e) =>
              e.target.value && cambiar({ fecha: e.target.value, omitir: [] })
            }
          />
        </Campo>
        <Campo
          id="reserva-hora"
          etiqueta="Hora"
          obligatorio
          error={errores.horaInicio}
        >
          <SelectorHora
            id="reserva-hora"
            valor={f.hora}
            onCambio={(hora) => cambiar({ hora })}
          />
        </Campo>
        {f.id ? null : (
          <div className="col-span-2 flex h-9 items-center gap-2 sm:col-span-1">
            <Checkbox
              id="reserva-repetir"
              checked={f.repetir !== null}
              onCheckedChange={(v) =>
                cambiar({
                  repetir: v === true ? { cada: "semana", veces: 4 } : null,
                  omitir: [],
                })
              }
            />
            <Label htmlFor="reserva-repetir" className="font-normal">
              Repetir
            </Label>
          </div>
        )}
      </div>
      {f.repetir ? (
        <SerieReserva
          fecha={f.fecha}
          repetir={f.repetir}
          omitir={f.omitir}
          revision={p.revision}
          revisando={p.revisando}
          onCambio={cambiar}
        />
      ) : null}

      <Campo
        id="reserva-cliente"
        etiqueta="Cliente"
        obligatorio
        error={errores.clienteId}
      >
        <div ref={zonaCliente}>
          {f.cliente ? (
            <TarjetaCliente
              cliente={f.cliente}
              citaId={f.id}
              avisoCorreo={f.avisoCorreo}
              avisoWhatsapp={f.avisoWhatsapp}
              onAvisos={cambiar}
              onEditar={p.onEditarCliente}
              onQuitar={() => cambiar({ cliente: null })}
            />
          ) : celular ? (
            <BotonBuscarCliente
              id="reserva-cliente"
              invalido={Boolean(errores.clienteId)}
              onAbrir={() => setHojaCliente(true)}
            />
          ) : (
            <BuscadorClientes
              id="reserva-cliente"
              invalido={Boolean(errores.clienteId)}
              onElegir={(c) => cambiar({ cliente: aElegido(c) })}
              onNuevo={p.onNuevoCliente}
            />
          )}
        </div>
      </Campo>
      {celular ? (
        <HojaElegirCliente
          id="reserva-cliente"
          abierta={hojaCliente}
          onCambiar={setHojaCliente}
          onElegir={(c) => cambiar({ cliente: aElegido(c) })}
          onNuevo={p.onNuevoCliente}
          // Al elegir, el botón se cambia por la tarjeta: el foco va a su primer botón.
          volverA={() => zonaCliente.current?.querySelector("button") ?? null}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Campo
          id="reserva-profesional"
          etiqueta="Profesional"
          obligatorio
          error={errores.profesionalId}
        >
          <div className="flex gap-1.5">
            <select
              id="reserva-profesional"
              className={CONTROL}
              value={f.profesionalId}
              disabled={bloqueado}
              aria-invalid={Boolean(errores.profesionalId)}
              onChange={(e) => elegirProfesional(e.target.value)}
            >
              <option value="">Elige un profesional</option>
              {profesionales.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-pressed={f.profesionalFijo}
              aria-label={
                f.profesionalFijo
                  ? "Profesional fijo (quitar)"
                  : "Fijar profesional"
              }
              title={
                f.profesionalFijo
                  ? "Fijo: la cita no se puede pasar a otro profesional"
                  : "Fijar: que la cita no se pueda pasar a otro profesional"
              }
              onClick={() => cambiar({ profesionalFijo: !f.profesionalFijo })}
              className={cn(
                "inline-flex h-11 w-11 md:h-9 md:w-9 shrink-0 items-center justify-center rounded-md border",
                f.profesionalFijo
                  ? "border-ac-laguna bg-ac-laguna-claro text-ac-laguna-hondo"
                  : "border-ac-borde text-ac-pizarra hover:bg-ac-niebla",
              )}
            >
              {f.profesionalFijo ? (
                <Lock className="h-4 w-4" />
              ) : (
                <LockOpen className="h-4 w-4" />
              )}
            </button>
          </div>
        </Campo>
        <Campo
          id="reserva-servicio"
          etiqueta="Servicio"
          obligatorio
          error={errores.servicioId}
        >
          {celular ? (
            <SelectorServicio
              id="reserva-servicio"
              servicios={servicios}
              valor={f.servicioId}
              deshabilitado={!f.profesionalId}
              invalido={Boolean(errores.servicioId)}
              onElegir={elegirServicio}
            />
          ) : (
            <select
              id="reserva-servicio"
              className={CONTROL}
              value={f.servicioId}
              disabled={!f.profesionalId}
              aria-invalid={Boolean(errores.servicioId)}
              onChange={(e) => elegirServicio(e.target.value)}
            >
              <option value="">
                {f.profesionalId
                  ? "Elige un servicio"
                  : "Elige un profesional primero"}
              </option>
              {categorias.map((c) => (
                <optgroup key={c} label={c || "Servicios"}>
                  {servicios
                    .filter((s) => s.categoria === c)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre} · {duracion(s.duracionMin)} ·{" "}
                        {pesos(s.precio)}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          )}
        </Campo>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Fin</p>
          <p
            className="cifras flex h-9 items-center text-sm"
            aria-live="polite"
          >
            {fin || "—"}
          </p>
        </div>
      </div>

      <Accordion
        type="single"
        collapsible
        defaultValue={f.recursoId && !f.id ? "mas" : undefined}
      >
        <AccordionItem value="mas" className="border-ac-borde">
          <AccordionTrigger className="py-2 text-sm">
            Información adicional{f.servicioId ? ` · ${pesos(f.precio)}` : ""}
          </AccordionTrigger>
          <AccordionContent className="grid gap-3 sm:grid-cols-2">
            <Campo
              id="reserva-precio"
              etiqueta="Precio (COP)"
              error={errores.precio}
            >
              <Input
                id="reserva-precio"
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                value={Number.isNaN(f.precio) ? "" : f.precio}
                onChange={(e) =>
                  cambiar({
                    precio:
                      e.target.value === ""
                        ? Number.NaN
                        : Number(e.target.value),
                  })
                }
              />
            </Campo>
            {recursos.length ? (
              <Campo
                id="reserva-recurso"
                etiqueta="Recurso"
                error={errores.recursoId}
              >
                <select
                  id="reserva-recurso"
                  className={CONTROL}
                  value={f.recursoId}
                  onChange={(e) => cambiar({ recursoId: e.target.value })}
                >
                  <option value="">
                    {usaRecurso ? "Automático (el primero libre)" : "Ninguno"}
                  </option>
                  {recursos.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
            ) : (
              <div className="hidden sm:block" />
            )}
            <Campo
              id="reserva-nota-cliente"
              etiqueta="Nota para el cliente"
              error={errores.notaCliente}
            >
              <Textarea
                id="reserva-nota-cliente"
                rows={2}
                maxLength={500}
                value={f.notaCliente}
                onChange={(e) => cambiar({ notaCliente: e.target.value })}
              />
            </Campo>
            <Campo
              id="reserva-nota-interna"
              etiqueta="Nota interna"
              error={errores.notaInterna}
            >
              <Textarea
                id="reserva-nota-interna"
                rows={2}
                maxLength={500}
                value={f.notaInterna}
                onChange={(e) => cambiar({ notaInterna: e.target.value })}
              />
            </Campo>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
