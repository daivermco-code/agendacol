"use client";

import { Gift, Stamp } from "lucide-react";
import {
  contarSellos,
  sellosVisibles,
  type ProgramaSellos,
} from "../lib/sellos";
import { BotonEntregar } from "./fidelizacion-vista";
import { PuntosSellos } from "./tarjeta-sellos";

/** Pestaña Fidelización de la ficha: la tarjeta en curso, premios ganados y el botón para entregar uno. */
export function SellosCliente({
  clienteId,
  nombre,
  programa,
  sellos,
  canjes,
  puedeEntregar,
}: {
  clienteId: string;
  nombre: string;
  programa: ProgramaSellos;
  sellos: number;
  canjes: number;
  puedeEntregar: boolean;
}) {
  const c = contarSellos(sellos, canjes, programa.meta);
  const pintados = sellosVisibles(c, programa.meta);
  return (
    <section className="space-y-3 rounded-lg border border-ac-borde bg-ac-papel p-4 shadow-quieta">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ac-laguna-claro text-ac-laguna-hondo">
          <Stamp className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="text-sm">
          <p className="font-semibold">Tarjeta de sellos</p>
          <p className="text-ac-pizarra">
            {programa.activo
              ? `Con ${programa.meta} sellos gana: ${programa.premio}.`
              : "El programa está apagado: las citas nuevas no suman sellos."}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <PuntosSellos enTarjeta={pintados} meta={programa.meta} />
        <span className="cifras text-sm font-medium">
          {pintados} de {programa.meta}
        </span>
      </div>
      <p className="cifras text-sm text-ac-pizarra">
        {sellos} {sellos === 1 ? "sello" : "sellos"} en total · {c.ganados}{" "}
        {c.ganados === 1 ? "premio ganado" : "premios ganados"} · {canjes}{" "}
        {canjes === 1 ? "entregado" : "entregados"}
      </p>
      {c.porEntregar > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-ac-aviso-fondo px-3 py-2 text-sm text-ac-aviso">
          <Gift className="h-4 w-4" aria-hidden="true" />
          <span className="flex-1">
            {c.porEntregar === 1
              ? "Tiene un premio por entregar."
              : `Tiene ${c.porEntregar} premios por entregar.`}
          </span>
          {puedeEntregar ? (
            <BotonEntregar
              clienteId={clienteId}
              nombre={nombre}
              premio={programa.premio}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
