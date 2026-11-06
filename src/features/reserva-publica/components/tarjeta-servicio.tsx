"use client";

import Image from "next/image";
import { Clock, Minus, Plus } from "lucide-react";
import { duracion, pesos } from "@/shared/lib/formato";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import type { ServicioPublico } from "../types";

interface Props {
  servicio: ServicioPublico;
  cantidad: number;
  /** Ya no cabe otro (máximo de servicios o de horas por reserva). */
  lleno: boolean;
  apagado: boolean;
  onCambiar: (cantidad: number) => void;
}

/** Tarjeta de un servicio: nombre, descripción, duración y precio; "Agregar" o quitar · cantidad · más. */
export function TarjetaServicio({
  servicio: s,
  cantidad,
  lleno,
  apagado,
  onCambiar,
}: Props) {
  const elegido = cantidad > 0;
  return (
    <article
      className={cn(
        "flex gap-4 rounded-lg border bg-ac-papel p-4 transition-colors",
        elegido ? "border-ac-laguna ring-1 ring-ac-laguna" : "border-ac-borde",
      )}
    >
      {s.imagen ? (
        <Image
          src={s.imagen}
          alt=""
          width={80}
          height={80}
          className="h-20 w-20 shrink-0 rounded-md object-cover"
        />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="font-semibold">{s.nombre}</h3>
        {s.descripcion ? (
          <p className="mt-0.5 line-clamp-2 text-ac-pizarra">{s.descripcion}</p>
        ) : null}
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {s.mostrarDuracion ? (
            <span className="inline-flex items-center gap-1 text-ac-pizarra">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {duracion(s.duracion)}
            </span>
          ) : null}
          {s.precio !== null ? (
            <span className="font-semibold">{pesos(s.precio)}</span>
          ) : null}
        </p>
        <div className="mt-auto flex justify-end pt-3">
          {elegido ? (
            <div className="inline-flex items-center gap-1 rounded-md border border-ac-borde-fuerte bg-ac-papel p-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="md:h-8 md:w-8"
                onClick={() => onCambiar(cantidad - 1)}
                aria-label={`Quitar uno: ${s.nombre}`}
              >
                <Minus aria-hidden="true" />
              </Button>
              <span
                className="min-w-6 text-center font-semibold tabular-nums"
                aria-live="polite"
              >
                {cantidad}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="md:h-8 md:w-8"
                onClick={() => onCambiar(cantidad + 1)}
                disabled={lleno}
                aria-label={`Agregar otro: ${s.nombre}`}
              >
                <Plus aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-ac-laguna text-ac-laguna hover:bg-ac-laguna-claro hover:text-ac-laguna-hondo"
              onClick={() => onCambiar(1)}
              disabled={apagado || lleno}
              aria-label={`Agregar ${s.nombre}`}
            >
              <Plus aria-hidden="true" />
              Agregar
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
