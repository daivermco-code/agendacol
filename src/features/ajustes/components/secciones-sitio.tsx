"use client";

import type { ReactNode } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Campo } from "@/shared/components/campo";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import {
  ANTICIPACION,
  DIAS_MAX,
  LIMITE_HORAS,
  type ValoresAjustes,
} from "../schemas";
import { Fila, SELECT } from "./fila-ajuste";

interface PropsSeccion {
  v: ValoresAjustes;
  cambiar: (c: Partial<ValoresAjustes>) => void;
  interruptor: (
    k:
      | "webClienteCancela"
      | "webClienteCambia"
      | "avisoEquipoReserva"
      | "avisoEquipoCambios",
  ) => ReactNode;
}

const anticipacion = (m: number) =>
  m < 60 ? `${m} minutos` : m < 1440 ? `${m / 60} horas` : "1 día";

async function copiarEnlace(slug: string) {
  try {
    await navigator.clipboard.writeText(
      `${window.location.origin}/reservar/${slug}`,
    );
    toast.success("Enlace copiado");
  } catch {
    toast.error("No se pudo copiar el enlace");
  }
}

/** Ajustes → Sitio web: cuándo se reserva en línea y qué puede hacer el cliente desde su enlace. */
export function SeccionSitioWeb({ v, cambiar, interruptor }: PropsSeccion) {
  const elegir =
    (k: "webAnticipacionMin" | "webDiasMax" | "webLimiteHoras") =>
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      cambiar({ [k]: Number(e.target.value) });
  return (
    <>
      <Fila
        titulo="Tu sitio de reservas"
        texto={`/reservar/${v.slug} · la dirección se cambia en Mi negocio.`}
      >
        <div className="flex gap-2" data-guia="sitio">
          <a
            href={`/reservar/${v.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 md:h-9 items-center gap-1.5 rounded-md border border-ac-borde px-3 text-sm hover:bg-ac-niebla"
          >
            Abrir <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={() => copiarEnlace(v.slug)}
            className="inline-flex h-11 md:h-9 items-center gap-1.5 rounded-md border border-ac-borde px-3 text-sm hover:bg-ac-niebla"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copiar enlace
          </button>
        </div>
      </Fila>
      <Fila
        titulo="Anticipación mínima"
        texto="Cuánto antes de la hora se puede reservar en línea."
      >
        <select
          value={v.webAnticipacionMin}
          onChange={elegir("webAnticipacionMin")}
          className={SELECT}
          aria-label="Anticipación mínima"
        >
          {ANTICIPACION.map((m) => (
            <option key={m} value={m}>
              {anticipacion(m)} antes
            </option>
          ))}
        </select>
      </Fila>
      <Fila
        titulo="Reservar hasta"
        texto="Hasta cuántos días adelante se ven horas libres."
      >
        <select
          value={v.webDiasMax}
          onChange={elegir("webDiasMax")}
          className={SELECT}
          aria-label="Reservar hasta"
        >
          {DIAS_MAX.map((d) => (
            <option key={d} value={d}>
              {d} días adelante
            </option>
          ))}
        </select>
      </Fila>
      <Fila
        titulo="El cliente cancela desde su enlace"
        texto="Si está apagado, el enlace le pide comunicarse con el negocio."
      >
        {interruptor("webClienteCancela")}
      </Fila>
      <Fila
        titulo="El cliente cambia la fecha u hora desde su enlace"
        texto="Con el mismo profesional y la misma duración."
      >
        {interruptor("webClienteCambia")}
      </Fila>
      <Fila
        titulo="Cambios y cancelaciones en línea hasta"
        texto="Pasado ese límite, el cliente debe llamar o escribir."
      >
        <select
          value={v.webLimiteHoras}
          onChange={elegir("webLimiteHoras")}
          className={SELECT}
          aria-label="Límite para cambios y cancelaciones"
          disabled={!v.webClienteCancela && !v.webClienteCambia}
        >
          {LIMITE_HORAS.map((h) => (
            <option key={h} value={h}>
              {h === 0 ? "La hora de la cita" : `${h} horas antes`}
            </option>
          ))}
        </select>
      </Fila>
      <div className="py-4">
        <Campo
          id="web-politica"
          etiqueta="Política para tus clientes"
          ayuda="Sale al reservar y en el enlace de cada cita. Máximo 600 letras."
        >
          <Textarea
            id="web-politica"
            rows={4}
            maxLength={600}
            value={v.webPolitica}
            onChange={(e) => cambiar({ webPolitica: e.target.value })}
            placeholder="Si llegas más de 15 minutos tarde, puede que tengamos que mover tu hora."
          />
        </Campo>
      </div>
    </>
  );
}

/** Ajustes → Avanzadas: avisos al equipo por lo que pasa en el sitio y redes sociales del sitio. */
export function SeccionAvanzadas({ v, cambiar, interruptor }: PropsSeccion) {
  const redes = [
    ["redInstagram", "Instagram"],
    ["redFacebook", "Facebook"],
    ["redTiktok", "TikTok"],
  ] as const;
  return (
    <>
      <h2 className="pt-5 font-semibold">Avisos al equipo</h2>
      <Fila
        titulo="Cuando un cliente reserva en línea"
        texto="Llega un correo con el cliente, el servicio y la hora (en la demo, al buzón)."
      >
        {interruptor("avisoEquipoReserva")}
      </Fila>
      <Fila titulo="Cuando un cliente cambia o cancela desde su enlace">
        {interruptor("avisoEquipoCambios")}
      </Fila>
      <div className="border-b border-ac-borde py-4">
        <Campo
          id="aviso-equipo-correo"
          etiqueta="Correo para estos avisos"
          ayuda="Vacío: al correo del local."
        >
          <Input
            id="aviso-equipo-correo"
            type="email"
            value={v.avisoEquipoCorreo}
            onChange={(e) => cambiar({ avisoEquipoCorreo: e.target.value })}
            className="sm:max-w-sm"
          />
        </Campo>
      </div>
      <h2 className="pt-5 font-semibold">Redes sociales</h2>
      <p className="text-sm text-ac-pizarra">
        Salen en tu sitio de reservas, junto a la ubicación.
      </p>
      <div className="grid gap-4 py-4 sm:grid-cols-3">
        {redes.map(([clave, red]) => (
          <Campo key={clave} id={clave} etiqueta={red}>
            <Input
              id={clave}
              value={v[clave]}
              placeholder="Usuario, sin @"
              onChange={(e) => cambiar({ [clave]: e.target.value })}
            />
          </Campo>
        ))}
      </div>
    </>
  );
}
