"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export interface GrupoLateral {
  nombre: string;
  plegable?: boolean;
  opciones: { nombre: string; href: string }[];
}

/** Barra lateral de sección (Administración, Ajustes): tarjeta papel; activa en verde laguna. */
export function BarraLateral({ titulo, grupos }: { titulo: string; grupos: GrupoLateral[] }) {
  const ruta = usePathname();
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(grupos.map((g) => [g.nombre, !g.plegable || g.opciones.some((o) => ruta.startsWith(o.href))])),
  );
  const [movilAbierta, setMovilAbierta] = useState(false);
  const actual = grupos.flatMap((g) => g.opciones).find((o) => ruta.startsWith(o.href));

  return (
    <aside className="w-full shrink-0 md:w-[220px] lg:w-[248px]">
      <button
        type="button"
        onClick={() => setMovilAbierta((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-ac-borde bg-ac-papel px-4 py-3 font-semibold md:hidden"
        aria-expanded={movilAbierta}
      >
        <span>
          <span className="block text-xs font-medium text-ac-pizarra">{titulo}</span>
          {actual?.nombre ?? titulo}
        </span>
        <ChevronDown className={cn("h-5 w-5 transition-transform", movilAbierta && "rotate-180")} aria-hidden="true" />
      </button>
      <nav
        aria-label={titulo}
        className={cn(
          "mt-2 space-y-2 md:mt-0 md:block",
          !movilAbierta && "hidden",
        )}
      >
        {grupos.map((g) => (
          <div key={g.nombre} className="rounded-lg border border-ac-borde bg-ac-papel p-2 shadow-quieta">
            <button
              type="button"
              disabled={!g.plegable}
              onClick={() => setAbiertos((a) => ({ ...a, [g.nombre]: !a[g.nombre] }))}
              className="flex w-full items-center justify-between px-3 py-3 text-left text-sm font-semibold text-ac-tinta disabled:cursor-default md:py-2"
              aria-expanded={abiertos[g.nombre]}
            >
              {g.nombre}
              {g.plegable ? (
                <ChevronDown className={cn("h-4 w-4 transition-transform", abiertos[g.nombre] && "rotate-180")} aria-hidden="true" />
              ) : null}
            </button>
            {abiertos[g.nombre]
              ? g.opciones.map((o) => {
                  const activa = ruta === o.href || ruta.startsWith(`${o.href}/`);
                  return (
                    <Link
                      key={o.href}
                      href={o.href}
                      onClick={() => setMovilAbierta(false)}
                      aria-current={activa ? "page" : undefined}
                      className={cn(
                        "block rounded-md px-3 py-3 text-sm transition-colors hover:bg-ac-niebla md:py-2",
                        activa && "bg-ac-laguna-claro font-semibold text-ac-laguna-hondo hover:bg-ac-laguna-claro",
                      )}
                    >
                      {o.nombre}
                    </Link>
                  );
                })
              : null}
          </div>
        ))}
      </nav>
    </aside>
  );
}
