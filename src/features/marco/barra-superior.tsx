"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import { Logo } from "@/shared/assets/logo";
import { cn } from "@/shared/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { seccionActiva, type OpcionMenu, type SeccionMenu } from "./menu";
import { MenuEngranaje, MenuReservasEnLinea, MenuUsuario } from "./menus-barra";
import { MenuMovil } from "./menu-movil";
import { BotonPrimerosPasos } from "./primeros-pasos";

const OPCION =
  "inline-flex h-9 items-center gap-1 rounded-md px-3 text-sm font-medium text-ac-sobre-noche-suave transition-colors hover:bg-ac-noche-claro hover:text-ac-sobre-noche xl:px-4";
const OPCION_ACTIVA = "bg-white/[0.12] text-ac-sobre-noche";

interface BarraSuperiorProps {
  secciones: SeccionMenu[];
  ajustes: OpcionMenu[];
  pasosHechos: number;
  verReservas: boolean;
}

/** Barra de 52 px azul noche desde 768 px: menú completo desde 1024; logo centrado y hamburguesa de 768 a 1023. */
export function BarraSuperior({
  secciones,
  ajustes,
  pasosHechos,
  verReservas,
}: BarraSuperiorProps) {
  const ruta = usePathname();
  const activa = seccionActiva(ruta);

  return (
    <div className="relative hidden h-barra items-center bg-ac-noche px-4 text-ac-sobre-noche md:flex">
      {/* Tableta vertical (en el celular manda la cabecera de la app, `cabecera-movil.tsx`) */}
      <div className="flex w-full items-center justify-center lg:hidden">
        <Link
          href="/"
          aria-label="AgendaCol: ir al inicio"
          className="inline-flex min-h-11 items-center"
        >
          <Logo />
        </Link>
        <div className="absolute right-2">
          <MenuMovil
            secciones={secciones}
            ajustes={ajustes}
            verReservas={verReservas}
          />
        </div>
      </div>

      {/* Computador y tableta horizontal */}
      <div className="hidden w-full items-center gap-2 lg:flex xl:gap-4">
        <Link
          href="/"
          aria-label="AgendaCol: ir al inicio"
          className="mr-1 shrink-0 rounded-md xl:mr-3"
        >
          <Logo />
        </Link>
        <nav
          aria-label="Menú principal"
          className="flex min-w-0 items-center gap-0.5 xl:gap-1"
        >
          {secciones.map((s) =>
            s.href ? (
              <Link
                key={s.nombre}
                href={s.href}
                className={cn(OPCION, activa === s.nombre && OPCION_ACTIVA)}
                aria-current={activa === s.nombre ? "page" : undefined}
              >
                {s.nombre}
              </Link>
            ) : (
              <DropdownMenu key={s.nombre}>
                <DropdownMenuTrigger
                  className={cn(
                    OPCION,
                    "data-[state=open]:bg-ac-noche-claro",
                    activa === s.nombre && OPCION_ACTIVA,
                  )}
                >
                  {s.nombre}
                  <ChevronDown
                    className="h-4 w-4 opacity-70"
                    aria-hidden="true"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-56">
                  {s.opciones.map((o) => (
                    <DropdownMenuItem
                      key={o.href}
                      asChild
                      className={cn(
                        ruta === o.href && "bg-ac-laguna-claro font-semibold",
                      )}
                    >
                      <Link href={o.href}>{o.nombre}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          )}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1 xl:gap-2">
          <Link
            href="/buscar"
            aria-label="Buscar"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-ac-noche-claro"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </Link>
          {verReservas ? <BotonPrimerosPasos hechos={pasosHechos} /> : null}
          {verReservas ? <MenuReservasEnLinea /> : null}
          <MenuEngranaje opciones={ajustes} />
          <MenuUsuario />
        </div>
      </div>
    </div>
  );
}
