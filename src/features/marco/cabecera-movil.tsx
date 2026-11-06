"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, Search } from "lucide-react";
import { Logo } from "@/shared/assets/logo";
import { pestanaActiva } from "./menu";

/** Pantallas que dibujan su propia cabecera en el celular (con sus subrutas). */
const CON_CABECERA_PROPIA = ["/agenda"];

/** Pestañas que abren con su título grande y sus acciones, sin la fila del logo. */
const PESTANAS_CON_TITULO = ["/clientes", "/ventas/detalle", "/ajustes"];

/**
 * Cabecera del celular (< 768 px), en lugar de la barra azul: a la izquierda el logo, o "‹ Ajustes" en las
 * pantallas que se abren desde el centro; a la derecha, Buscar. El título grande lo pone cada pantalla.
 */
export function CabeceraMovil() {
  const ruta = usePathname();
  // Inicio trae su cabecera de color (T-12.9); solo "/", no las demás rutas.
  if (
    ruta === "/" ||
    PESTANAS_CON_TITULO.includes(ruta) ||
    CON_CABECERA_PROPIA.some((r) => ruta === r || ruta.startsWith(`${r}/`))
  ) {
    return null;
  }
  const volverAjustes =
    pestanaActiva(ruta) === "ajustes" && ruta !== "/ajustes";
  // Avisos se abre desde la campana del Inicio.
  const volver = volverAjustes
    ? { href: "/ajustes", nombre: "Ajustes" }
    : ruta === "/avisos"
      ? { href: "/", nombre: "Inicio" }
      : null;

  return (
    <div className="flex h-12 items-center justify-between px-2 md:hidden">
      {volver ? (
        <Link
          href={volver.href}
          className="inline-flex h-11 items-center gap-0.5 rounded-md pl-1 pr-3 text-[15px] font-semibold text-ac-laguna"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          {volver.nombre}
        </Link>
      ) : (
        <Link
          href="/"
          aria-label="AgendaCol: ir al inicio"
          className="inline-flex h-11 items-center rounded-md px-2"
        >
          <Logo tono="claro" />
        </Link>
      )}
      <Link
        href="/buscar"
        aria-label="Buscar"
        className="area-tactil inline-flex h-10 w-10 items-center justify-center rounded-full text-ac-tinta hover:bg-ac-niebla-oscura"
      >
        <Search className="h-5 w-5" aria-hidden="true" />
      </Link>
    </div>
  );
}
