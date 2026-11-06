"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  House,
  Receipt,
  Settings,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { pestanaActiva, type ClavePestana, type Pestana } from "./menu";

const ICONOS: Record<ClavePestana, LucideIcon> = {
  inicio: House,
  agenda: CalendarDays,
  clientes: UsersRound,
  ventas: Receipt,
  ajustes: Settings,
};

/**
 * Barra de pestañas del celular (DESIGN.md §5, App de celular): píldora flotante abajo, solo por debajo de
 * 768 px. Se esconde con CSS, no con JS, para que el servidor y el navegador dibujen lo mismo. Su alto se
 * reserva con `--alto-pestanas` (globals.css), que lee `data-pestanas`.
 */
export function BarraPestanas({ pestanas }: { pestanas: Pestana[] }) {
  const activa = pestanaActiva(usePathname());

  return (
    <nav
      aria-label="Pestañas"
      data-pestanas=""
      className="fixed inset-x-4 bottom-[calc(16px+env(safe-area-inset-bottom))] z-30 flex rounded-full border border-ac-borde bg-ac-papel p-1 shadow-flota md:hidden print:hidden"
    >
      {pestanas.map((p) => {
        const Icono = ICONOS[p.clave];
        const actual = p.clave === activa;
        return (
          <Link
            key={p.clave}
            href={p.href}
            aria-current={actual ? "page" : undefined}
            className={cn(
              "flex h-[50px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-semibold leading-none transition-colors",
              actual
                ? "bg-ac-laguna-claro text-ac-laguna-hondo"
                : "text-ac-pizarra hover:text-ac-tinta",
            )}
          >
            <Icono className="h-[22px] w-[22px]" aria-hidden="true" />
            <span className="max-w-full truncate px-1">{p.nombre}</span>
          </Link>
        );
      })}
    </nav>
  );
}
