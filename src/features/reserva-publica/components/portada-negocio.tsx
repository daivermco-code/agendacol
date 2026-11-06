import Image from "next/image";
import { AtSign, MapPin, Navigation, Phone } from "lucide-react";
import { telefono } from "@/shared/lib/formato";
import { enlaceMapa } from "../lib/calendario";
import type { Portada } from "../types";
import { LogoNegocio } from "./cabecera-negocio";
import { VerHorario } from "./ver-horario";

/** Redes del negocio (Ajustes → Avanzadas) con su enlace. */
function redesDe(redes: Portada["redes"]) {
  return [
    redes.instagram && {
      red: "Instagram",
      usuario: redes.instagram,
      url: `https://www.instagram.com/${redes.instagram}/`,
    },
    redes.facebook && {
      red: "Facebook",
      usuario: redes.facebook,
      url: `https://www.facebook.com/${redes.facebook}`,
    },
    redes.tiktok && {
      red: "TikTok",
      usuario: redes.tiktok,
      url: `https://www.tiktok.com/@${redes.tiktok}`,
    },
  ].filter((r) => !!r);
}

/** Encabezado de la portada: foto (o fondo de marca), logo, nombre y la tarjeta de ubicación y horario. */
export function PortadaNegocio({
  portada,
  hoyIso,
}: {
  portada: Portada;
  hoyIso: number;
}) {
  const { negocio, local } = portada;
  const redes = redesDe(portada.redes);
  return (
    <section className="border-b border-ac-borde bg-ac-papel">
      <div className="mx-auto grid max-w-5xl gap-5 px-4 pb-6 pt-4 lg:grid-cols-[1fr_320px] lg:gap-6 lg:pt-6">
        <div className="min-w-0">
          <div className="relative aspect-[16/7] overflow-hidden rounded-lg bg-ac-noche">
            {local.portada ? (
              // La imagen más grande de la página (LCP): sin carga diferida. 648 px = el ancho de la columna desde `lg`.
              <Image
                src={local.portada}
                alt=""
                fill
                sizes="(min-width: 1024px) 648px, 100vw"
                loading="eager"
                fetchPriority="high"
                className="object-cover"
              />
            ) : (
              <FondoMarca />
            )}
          </div>
          <div className="relative z-10 -mt-9 flex items-start gap-4 px-3 sm:-mt-11 sm:px-5">
            <LogoNegocio
              nombre={negocio.nombre}
              logo={negocio.logo}
              lado={88}
              className="h-[72px] w-[72px] shrink-0 text-2xl shadow-flota ring-4 ring-ac-papel sm:h-[88px] sm:w-[88px] sm:text-3xl"
            />
            <div className="min-w-0 pt-10 sm:pt-12">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                {negocio.nombre}
              </h1>
              <p className="truncate text-sm text-ac-pizarra">{local.nombre}</p>
            </div>
          </div>
          {negocio.descripcion ? (
            <p className="mt-4 max-w-prose text-ac-pizarra">
              {negocio.descripcion}
            </p>
          ) : null}
        </div>

        <aside className="space-y-4 self-start rounded-lg border border-ac-borde p-4 shadow-quieta">
          <h2 className="text-sm font-semibold">Ubicación y horario</h2>
          {local.direccion ? (
            <div className="flex items-start gap-3">
              <MapPin
                className="mt-0.5 h-4 w-4 shrink-0 text-ac-pizarra"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p>{local.direccion}</p>
                <a
                  href={enlaceMapa(local.direccion)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-ac-laguna underline-offset-2 hover:underline -my-1.5 py-3 md:my-0 md:py-0"
                >
                  <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
                  Cómo llegar
                </a>
              </div>
            </div>
          ) : null}
          {local.telefono ? (
            <div className="flex items-center gap-3">
              <Phone
                className="h-4 w-4 shrink-0 text-ac-pizarra"
                aria-hidden="true"
              />
              <a
                href={`tel:${local.telefono}`}
                className="rounded-sm underline-offset-2 hover:underline -my-1.5 py-3 md:my-0 md:py-0"
              >
                {telefono(local.telefono)}
              </a>
            </div>
          ) : null}
          {redes.map((r) => (
            <div key={r.red} className="flex items-center gap-3">
              <AtSign
                className="h-4 w-4 shrink-0 text-ac-pizarra"
                aria-hidden="true"
              />
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 truncate rounded-sm underline-offset-2 hover:underline -my-1.5 py-3 md:my-0 md:py-0"
              >
                {r.usuario}
                <span className="text-ac-pizarra"> en {r.red}</span>
              </a>
            </div>
          ))}
          <VerHorario horario={portada.horario} hoyIso={hoyIso} />
        </aside>
      </div>
    </section>
  );
}

/** Portada sin foto: degradado de la marca con anillos suaves (no una foto genérica). */
function FondoMarca() {
  return (
    <svg
      viewBox="0 0 640 280"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className="h-full w-full"
    >
      <defs>
        <linearGradient id="portada-fondo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="hsl(var(--ac-laguna))" />
          <stop offset="1" stopColor="hsl(var(--ac-noche))" />
        </linearGradient>
      </defs>
      <rect width="640" height="280" fill="url(#portada-fondo)" />
      <g
        fill="none"
        stroke="hsl(var(--ac-papel))"
        strokeOpacity="0.12"
        strokeWidth="2"
      >
        <circle cx="560" cy="40" r="90" />
        <circle cx="560" cy="40" r="140" />
        <circle cx="560" cy="40" r="190" />
        <circle cx="80" cy="300" r="120" />
      </g>
    </svg>
  );
}
