"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BellOff,
  BellRing,
  CalendarPlus,
  CalendarX,
  CheckCheck,
  Hourglass,
  MessageCircle,
  PackageX,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Vacio } from "@/shared/components/vacio";
import { cn } from "@/shared/lib/utils";
import { useVisto } from "../hooks/use-visto";
import {
  agrupar,
  contarNuevos,
  cuandoFue,
  esNuevo,
  FICHAS,
  filtrar,
  masNuevo,
  type Aviso,
  type Ficha,
  type TipoAviso,
} from "../lib/avisos";

const ICONO: Record<TipoAviso, { icono: LucideIcon; tono: string }> = {
  reserva: { icono: CalendarPlus, tono: "bg-ac-laguna-claro text-ac-laguna" },
  cancelacion: { icono: CalendarX, tono: "bg-ac-error/10 text-ac-error" },
  espera: { icono: Hourglass, tono: "bg-ac-laguna-claro text-ac-laguna" },
  espera_avisada: { icono: BellRing, tono: "bg-ac-info-fondo text-ac-info" },
  pago: { icono: Wallet, tono: "bg-ac-exito/10 text-ac-exito" },
  stock: { icono: PackageX, tono: "bg-ac-aviso/10 text-ac-aviso" },
  respuesta: { icono: MessageCircle, tono: "bg-ac-info-fondo text-ac-info" },
};

const VACIO: Record<Ficha, { titulo: string; texto: string }> = {
  todos: {
    titulo: "Sin avisos",
    texto:
      "Aquí aparecen las reservas en línea, los pagos y la lista de espera de las últimas 2 semanas.",
  },
  no_leidos: {
    titulo: "Estás al día",
    texto: "No hay avisos nuevos desde la última vez.",
  },
  reservas: {
    titulo: "Sin avisos de reservas",
    texto: "Ni reservas en línea, ni cancelaciones, ni lista de espera.",
  },
  pagos: {
    titulo: "Sin pagos",
    texto: "No se registraron pagos en las últimas 2 semanas.",
  },
  sistema: {
    titulo: "Sin avisos del sistema",
    texto: "Ni stock bajo, ni horas liberadas, ni respuestas por WhatsApp.",
  },
};

/**
 * Avisos del negocio (T-12.10): fichas para filtrar y tarjetas por día. Al abrir la pantalla todo queda leído en
 * este equipo, pero lo nuevo sigue marcado hasta salir o tocar "Marcar todo como leído".
 */
export function ListaAvisos({
  avisos,
  hoy,
  ahora,
  fichasVisibles,
}: {
  avisos: Aviso[];
  /** 'YYYY-MM-DD' en Bogotá. */
  hoy: string;
  /** ISO de cuando se armó la página: así "Hace 5 min" sale igual en el servidor y en el navegador. */
  ahora: string;
  fichasVisibles: Ficha[];
}) {
  const { visto, listo, marcar } = useVisto();
  // Lo leído ANTES de abrir: lo que marca los puntos mientras se está aquí. undefined = aún sin leer el equipo.
  const [antes, setAntes] = useState<string | null | undefined>(undefined);
  if (listo && antes === undefined) setAntes(visto);
  const [ficha, setFicha] = useState<Ficha>("todos");
  const titulo = useRef<HTMLHeadingElement>(null);

  const ultimo = useMemo(() => masNuevo(avisos), [avisos]);
  useEffect(() => {
    if (listo && ultimo) marcar(ultimo);
  }, [listo, ultimo, marcar]);

  // Antes de leer el equipo nada se marca como nuevo (evita que parpadee el punto).
  const referencia = antes === undefined ? (ultimo ?? null) : antes;
  const nuevos = contarNuevos(avisos, referencia);
  const grupos = useMemo(
    () => agrupar(filtrar(avisos, ficha, referencia), hoy),
    [avisos, ficha, referencia, hoy],
  );
  const momento = useMemo(() => new Date(ahora), [ahora]);
  const fichas = FICHAS.filter((f) => fichasVisibles.includes(f.valor));

  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1
            ref={titulo}
            tabIndex={-1}
            className="text-[28px] font-bold leading-tight tracking-tight outline-none md:text-2xl"
          >
            Avisos
          </h1>
          {/* Hasta leer el equipo no se sabe qué es nuevo: el renglón queda reservado y sin anunciar. */}
          <p
            className="min-h-5 text-[14px] text-ac-pizarra"
            aria-live={antes === undefined ? undefined : "polite"}
          >
            {antes === undefined
              ? "\u00a0"
              : nuevos === 0
                ? "Todo leído"
                : `${nuevos} sin leer`}
          </p>
        </div>
        {nuevos > 0 ? (
          <button
            type="button"
            onClick={() => {
              setAntes(ultimo);
              // El botón desaparece: el foco no se pierde, vuelve al título.
              titulo.current?.focus();
            }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold text-ac-laguna hover:bg-ac-laguna-claro md:min-h-9"
          >
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            Marcar todo como leído
          </button>
        ) : null}
      </div>

      <div
        role="group"
        aria-label="Filtrar avisos"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
      >
        {fichas.map((f) => {
          const activa = f.valor === ficha;
          return (
            <button
              key={f.valor}
              type="button"
              aria-pressed={activa}
              onClick={() => setFicha(f.valor)}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[14px] font-semibold md:min-h-9",
                activa
                  ? "border-ac-noche bg-ac-noche text-ac-sobre-noche"
                  : "border-ac-borde bg-ac-papel text-ac-tinta hover:bg-ac-niebla",
              )}
            >
              {f.nombre}
              {f.valor === "no_leidos" && nuevos > 0 ? (
                <span
                  className={cn(
                    "cifras rounded-full px-1.5 text-[12px]",
                    activa
                      ? "bg-ac-sobre-noche text-ac-noche"
                      : "bg-ac-laguna text-ac-papel",
                  )}
                >
                  {nuevos}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {grupos.length === 0 ? (
        <Vacio
          icono={ficha === "no_leidos" ? CheckCheck : BellOff}
          titulo={VACIO[ficha].titulo}
          texto={VACIO[ficha].texto}
        />
      ) : (
        grupos.map((g) => (
          <section key={g.titulo} aria-labelledby={`avisos-${g.titulo}`}>
            <h2
              id={`avisos-${g.titulo}`}
              className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ac-pizarra"
            >
              {g.titulo}
            </h2>
            <ul className="space-y-2">
              {g.avisos.map((a) => (
                <li key={a.id}>
                  <TarjetaAviso
                    aviso={a}
                    nuevo={esNuevo(a, referencia)}
                    cuando={cuandoFue(a.fecha, momento)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}

function TarjetaAviso({
  aviso,
  nuevo,
  cuando,
}: {
  aviso: Aviso;
  nuevo: boolean;
  cuando: string;
}) {
  const { icono: Icono, tono } = ICONO[aviso.tipo];
  return (
    <Link
      href={aviso.enlace}
      className={cn(
        "flex min-h-11 items-start gap-3 rounded-2xl border p-3 hover:bg-ac-niebla",
        nuevo
          ? "border-ac-laguna/40 bg-ac-laguna-claro/40"
          : "border-ac-borde bg-ac-papel",
      )}
    >
      <span
        className={cn(
          "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          tono,
        )}
      >
        <Icono className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-semibold">
            {nuevo ? <span className="sr-only">Nuevo: </span> : null}
            {aviso.titulo}
          </span>
          <span className="shrink-0 text-[12px] text-ac-pizarra">{cuando}</span>
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[14px] text-ac-pizarra">
          {aviso.detalle}
        </span>
      </span>
      {nuevo ? (
        <span
          aria-hidden="true"
          className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-ac-laguna"
        />
      ) : null}
    </Link>
  );
}
