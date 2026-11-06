"use client";

import { useQuery } from "@tanstack/react-query";
import { Info, Pencil, X } from "lucide-react";
import { telefono } from "@/shared/lib/formato";
import { crearClienteNavegador } from "@/shared/lib/supabase/client";
import { iniciales } from "@/shared/lib/utils";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";
import { ESTADOS } from "@/features/agenda/lib/estados";
import type { ClienteElegido } from "../lib/reserva";

const CATORCE_DIAS = 14 * 86_400_000;

/** "Nuevo cliente" si se creó hace menos de dos semanas. */
export function esClienteNuevo(creado: string | null): boolean {
  return creado !== null && Date.now() - Date.parse(creado) < CATORCE_DIAS;
}

function Recientes({
  clienteId,
  citaId,
}: {
  clienteId: string;
  citaId?: string;
}) {
  const { data } = useQuery({
    queryKey: ["citas-recientes", clienteId],
    queryFn: async () => {
      const { data: filas } = await crearClienteNavegador()
        .from("citas")
        .select("id, fecha, hora_inicio, estado, servicios(nombre)")
        .eq("cliente_id", clienteId)
        .order("fecha", { ascending: false })
        .limit(4);
      return filas ?? [];
    },
  });
  const otras = (data ?? []).filter((c) => c.id !== citaId).slice(0, 3);
  if (!otras.length) return null;
  return (
    <div className="border-t border-ac-borde pt-2">
      <p className="text-xs font-semibold text-ac-pizarra">Recientes</p>
      <ul className="mt-1 space-y-0.5 text-xs">
        {otras.map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full"
              style={{ background: ESTADOS[c.estado].borde }}
            />
            <span className="cifras">
              {c.fecha.split("-").reverse().join("/")}
            </span>
            <span className="truncate">{c.servicios?.nombre}</span>
            <span className="text-ac-neblina">
              · {ESTADOS[c.estado].nombre}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Tarjeta del cliente elegido: contacto, aviso si falta, a qué medios se le avisa y sus citas recientes. */
export function TarjetaCliente({
  cliente,
  citaId,
  avisoCorreo,
  avisoWhatsapp,
  onAvisos,
  onEditar,
  onQuitar,
}: {
  cliente: ClienteElegido;
  citaId?: string;
  avisoCorreo: boolean;
  avisoWhatsapp: boolean;
  onAvisos: (c: { avisoCorreo?: boolean; avisoWhatsapp?: boolean }) => void;
  onEditar: () => void;
  onQuitar: () => void;
}) {
  const falta = [
    cliente.correo ? null : "correo",
    cliente.telefono ? null : "teléfono",
  ].filter(Boolean);
  return (
    <div className="space-y-2.5 rounded-lg border border-ac-borde bg-ac-niebla/50 p-3">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ac-laguna-claro text-[13px] font-bold text-ac-laguna-hondo">
          {iniciales(cliente.nombre)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            {cliente.nombre}
            {esClienteNuevo(cliente.creado) ? (
              <span className="rounded-full bg-ac-laguna-claro px-2 py-px text-[11px] font-semibold text-ac-laguna-hondo">
                Nuevo cliente
              </span>
            ) : null}
          </p>
          <p className="truncate text-[13px] text-ac-pizarra">
            {[cliente.correo, telefono(cliente.telefono)]
              .filter(Boolean)
              .join(" · ") || "Sin contacto"}
          </p>
        </div>
        <button
          type="button"
          aria-label="Editar contacto del cliente"
          onClick={onEditar}
          className="inline-flex h-11 w-11 md:h-8 md:w-8 items-center justify-center rounded-full hover:bg-ac-niebla"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Quitar cliente"
          onClick={onQuitar}
          className="inline-flex h-11 w-11 md:h-8 md:w-8 items-center justify-center rounded-full hover:bg-ac-niebla"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {falta.length ? (
        <p className="flex items-start gap-2 rounded-md bg-ac-info-fondo px-2.5 py-2 text-[13px] text-ac-info">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Le falta el {falta.join(" y el ")}: no recibirá avisos por ese
            medio.{" "}
            <button
              type="button"
              className="font-semibold underline"
              onClick={onEditar}
            >
              Completar
            </button>
          </span>
        </p>
      ) : null}
      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
        <legend className="sr-only">Avisos de esta cita</legend>
        <span className="text-ac-pizarra">Avisos y recordatorios:</span>
        <span className="flex items-center gap-1.5">
          <Checkbox
            id="aviso-correo"
            checked={avisoCorreo && Boolean(cliente.correo)}
            disabled={!cliente.correo}
            onCheckedChange={(v) => onAvisos({ avisoCorreo: v === true })}
          />
          <Label htmlFor="aviso-correo" className="font-normal">
            Correo
          </Label>
        </span>
        <span className="flex items-center gap-1.5">
          <Checkbox
            id="aviso-whatsapp"
            checked={avisoWhatsapp && Boolean(cliente.telefono)}
            disabled={!cliente.telefono}
            onCheckedChange={(v) => onAvisos({ avisoWhatsapp: v === true })}
          />
          <Label htmlFor="aviso-whatsapp" className="font-normal">
            WhatsApp
          </Label>
        </span>
      </fieldset>
      <Recientes clienteId={cliente.id} citaId={citaId} />
    </div>
  );
}
