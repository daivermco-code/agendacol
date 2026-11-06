import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { cn, iniciales } from "@/shared/lib/utils";

/**
 * Logo del negocio o, si no tiene, sus iniciales ("Salón Ceiba" → "SC"). `lado`: el mayor tamaño en px con que se
 * ve (el de `className` en la pantalla más grande).
 */
export function LogoNegocio({
  nombre,
  logo,
  lado,
  className,
}: {
  nombre: string;
  logo: string | null;
  lado: number;
  className?: string;
}) {
  return logo ? (
    <Image
      src={logo}
      alt=""
      width={lado}
      height={lado}
      className={cn("rounded-lg object-cover", className)}
    />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-ac-papel font-bold text-ac-laguna ring-1 ring-ac-borde",
        className,
      )}
    >
      {iniciales(nombre)}
    </span>
  );
}

interface Props {
  nombre: string;
  logo: string | null;
  slug: string;
  /** Enlace de "Atrás" en los pasos; sin él va "Mis citas". */
  volver?: { href: string; texto: string };
}

/** Cabecera blanca del sitio: el negocio a la izquierda (vuelve a la portada) y "Atrás" en los pasos o "Mis citas". */
export function CabeceraNegocio({ nombre, logo, slug, volver }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-ac-borde bg-ac-papel/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
        <Link
          href={`/reservar/${slug}`}
          className="flex min-w-0 items-center gap-2.5 rounded-md font-semibold min-h-11 md:min-h-0"
        >
          <LogoNegocio
            nombre={nombre}
            logo={logo}
            lado={32}
            className="h-8 w-8 text-xs"
          />
          <span className="truncate">{nombre}</span>
        </Link>
        {volver ? (
          <Link
            href={volver.href}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 min-h-11 md:min-h-0 text-sm font-medium text-ac-pizarra hover:bg-ac-niebla hover:text-ac-tinta"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {volver.texto}
          </Link>
        ) : (
          <Link
            href={`/reservar/${slug}/mis-citas`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 min-h-11 md:min-h-0 text-sm font-medium text-ac-pizarra hover:bg-ac-niebla hover:text-ac-tinta"
          >
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Mis citas
          </Link>
        )}
      </div>
    </header>
  );
}
