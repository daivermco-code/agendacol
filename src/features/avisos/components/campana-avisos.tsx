"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useVisto } from "../hooks/use-visto";

/** Campana de la cabecera del Inicio (T-12.10): lleva a Avisos y muestra un punto si hay algo sin leer. */
export function CampanaAvisos({
  masNuevo,
  className,
}: {
  /** Fecha del aviso más nuevo; null si no hay o no se pudo leer. */
  masNuevo: string | null;
  className?: string;
}) {
  const { visto, listo } = useVisto();
  const hayNuevos =
    listo &&
    masNuevo !== null &&
    (visto === null ||
      new Date(masNuevo).getTime() > new Date(visto).getTime());
  return (
    <Link
      href="/avisos"
      aria-label={hayNuevos ? "Avisos, hay nuevos" : "Avisos"}
      className={cn("relative", className)}
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {hayNuevos ? (
        <span
          aria-hidden="true"
          className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-ac-laguna ring-2 ring-ac-noche"
        />
      ) : null}
    </Link>
  );
}
