"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { useMiembro } from "@/features/auth/components/proveedor-miembro";
import { Logo } from "@/shared/assets/logo";
import { NOMBRE_ROL } from "@/shared/lib/permisos";
import { cn } from "@/shared/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet";
import { seccionActiva, type OpcionMenu, type SeccionMenu } from "./menu";
import { MenuReservasEnLinea, MenuUsuario } from "./menus-barra";

interface MenuMovilProps {
  secciones: SeccionMenu[];
  ajustes: OpcionMenu[];
  verReservas: boolean;
}

const ENLACE =
  "block rounded-md px-3 py-3 text-[15px] hover:bg-ac-niebla md:py-2.5";

/** Panel que baja desde arriba con las secciones en acordeón. Se cierra con ×, Escape o al elegir. */
export function MenuMovil({ secciones, ajustes, verReservas }: MenuMovilProps) {
  const [abierto, setAbierto] = useState(false);
  const ruta = usePathname();
  const activa = seccionActiva(ruta);
  const miembro = useMiembro();
  const cerrar = () => setAbierto(false);

  const grupos: SeccionMenu[] =
    ajustes.length > 0
      ? [...secciones, { nombre: "Ajustes", opciones: ajustes }]
      : secciones;

  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger
        className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-ac-noche-claro"
        aria-label="Abrir menú"
      >
        <Menu className="h-6 w-6" aria-hidden="true" />
      </SheetTrigger>
      <SheetContent
        side="top"
        className="max-h-[100dvh] overflow-y-auto p-0 data-[state=closed]:duration-200 data-[state=open]:duration-200 [&>button:first-child]:top-3.5 [&>button:first-child]:text-ac-sobre-noche [&>button:first-child>svg]:h-6 [&>button:first-child>svg]:w-6"
      >
        <SheetTitle className="sr-only">Menú</SheetTitle>
        <div className="flex h-barra items-center bg-ac-noche px-4">
          <Logo />
        </div>
        <div className="flex items-center gap-3 border-b border-ac-borde px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">
              {miembro.nombre}
            </span>
            <span className="block text-xs text-ac-pizarra">
              {NOMBRE_ROL[miembro.rol]}
            </span>
          </span>
          <MenuUsuario />
        </div>
        <nav aria-label="Menú principal" className="px-2 py-2">
          <Link
            href="/buscar"
            onClick={cerrar}
            className={cn(ENLACE, "flex items-center gap-2 text-ac-pizarra")}
          >
            <Search className="h-4 w-4" aria-hidden="true" /> Buscar
          </Link>
          <Accordion
            type="single"
            collapsible
            defaultValue={activa ?? undefined}
          >
            {grupos.map((s) =>
              s.href ? (
                <Link
                  key={s.nombre}
                  href={s.href}
                  onClick={cerrar}
                  className={cn(
                    ENLACE,
                    "font-semibold",
                    activa === s.nombre &&
                      "bg-ac-laguna-claro text-ac-laguna-hondo",
                  )}
                >
                  {s.nombre}
                </Link>
              ) : (
                <AccordionItem
                  key={s.nombre}
                  value={s.nombre}
                  className="border-b-0"
                >
                  <AccordionTrigger
                    className={cn(
                      "rounded-md px-3 py-2.5 text-[15px] font-semibold hover:bg-ac-niebla hover:no-underline",
                      activa === s.nombre && "text-ac-laguna-hondo",
                    )}
                  >
                    {s.nombre}
                  </AccordionTrigger>
                  <AccordionContent className="pb-1">
                    {s.opciones.map((o) => (
                      <Link
                        key={o.href}
                        href={o.href}
                        onClick={cerrar}
                        className={cn(
                          ENLACE,
                          "pl-6",
                          ruta === o.href &&
                            "bg-ac-laguna-claro font-semibold text-ac-laguna-hondo",
                        )}
                      >
                        {o.nombre}
                      </Link>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ),
            )}
          </Accordion>
        </nav>
        {verReservas ? (
          <div className="border-t border-ac-borde p-4">
            <MenuReservasEnLinea compacto />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
