"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  ChevronRight,
  Clock,
  Sparkles,
  UserRoundX,
} from "lucide-react";
import { textoFranja, textoHoras } from "../lib/historia";
import type { Sugerencia } from "../types";
import { GeneradorHistoria } from "./generador-historia";

const TARJETA =
  "block w-full rounded-3xl bg-ac-laguna-claro p-4 text-left text-ac-tinta";

/** Sugerencia del día (T-12.9): horas libres (abre el generador de historia) o clientes que no vuelven. */
export function TarjetaSugerencia({
  sugerencia,
  negocio,
}: {
  sugerencia: Sugerencia;
  negocio: string;
}) {
  const [abierta, setAbierta] = useState(false);
  const datos = useMemo(
    () =>
      sugerencia.tipo === "horas"
        ? {
            cuando: sugerencia.cuando,
            inicio: sugerencia.franja.inicio,
            fin: sugerencia.franja.fin,
            profesionales: sugerencia.franja.profesionales,
            negocio,
            sede: sugerencia.sede,
          }
        : null,
    [sugerencia, negocio],
  );

  if (sugerencia.tipo === "clientes") {
    return (
      <section aria-label="Sugerencia de hoy">
        <Link href="/clientes/marketing" className={TARJETA}>
          <Cuerpo
            icono={<UserRoundX className="h-7 w-7" aria-hidden="true" />}
            frase={`${sugerencia.cantidad} ${sugerencia.cantidad === 1 ? "cliente no viene" : "clientes no vienen"} hace más de 2 meses`}
            detalle="Invítalos a volver con una campaña de correo"
            tiempo="3 min"
          />
        </Link>
      </section>
    );
  }

  return (
    <section aria-label="Sugerencia de hoy">
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className={TARJETA}
      >
        <Cuerpo
          icono={<CalendarCheck className="h-7 w-7" aria-hidden="true" />}
          frase={`${textoHoras(sugerencia.franja.minutosDelDia)} en la agenda ${sugerencia.cuando}`}
          detalle={`La franja más larga es ${textoFranja(sugerencia.franja.inicio, sugerencia.franja.fin)}${sugerencia.sede ? `, en ${sugerencia.sede}` : ""}. Comparte una historia para llenarla`}
          tiempo="1 min"
        />
      </button>
      {datos ? (
        <GeneradorHistoria
          abierta={abierta}
          onCambiar={setAbierta}
          datos={datos}
          slug={sugerencia.slug}
        />
      ) : null}
    </section>
  );
}

function Cuerpo({
  icono,
  frase,
  detalle,
  tiempo,
}: {
  icono: ReactNode;
  frase: string;
  detalle: string;
  tiempo: string;
}) {
  return (
    <>
      <span className="flex items-center justify-between">
        <span className="rounded-full bg-ac-laguna/15 px-3 py-1 text-[12px] font-semibold text-ac-laguna-hondo">
          Sugerencia de hoy
        </span>
        <Sparkles className="h-5 w-5 text-ac-laguna" aria-hidden="true" />
      </span>
      <span className="mt-3 flex items-start gap-3">
        <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ac-papel text-ac-laguna">
          {icono}
        </span>
        <span className="min-w-0">
          <span className="block text-[20px] font-bold leading-tight">
            {frase}
          </span>
          <span className="mt-1 block text-[14px] text-ac-pizarra">
            {detalle}
          </span>
        </span>
      </span>
      <span className="mt-3 flex items-center justify-between text-[13px] text-ac-pizarra">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-4 w-4" aria-hidden="true" />
          {tiempo}
        </span>
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </span>
    </>
  );
}
