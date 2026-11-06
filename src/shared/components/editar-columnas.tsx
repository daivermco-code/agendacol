"use client";

import { Columns3 } from "lucide-react";
import type { ColumnaListado } from "@/shared/lib/csv";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

/** «Editar columnas»: qué columnas ver en la tabla (y en el CSV). Las fijas no se pueden quitar. */
export function EditarColumnas({
  todas,
  visibles,
  onCambio,
}: {
  todas: readonly ColumnaListado[];
  visibles: readonly ColumnaListado[];
  onCambio: (claves: string[]) => void;
}) {
  const marcada = (c: ColumnaListado) =>
    visibles.some((v) => v.clave === c.clave);
  function alternar(c: ColumnaListado, si: boolean) {
    onCambio(
      todas
        .filter((t) => (t.clave === c.clave ? si : marcada(t)))
        .map((t) => t.clave),
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Columns3 className="h-4 w-4" aria-hidden="true" /> Editar columnas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Columnas a la vista</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {todas.map((c) => (
          <DropdownMenuCheckboxItem
            key={c.clave}
            checked={marcada(c)}
            disabled={c.fija}
            onCheckedChange={(si) => alternar(c, si === true)}
            onSelect={(e) => e.preventDefault()}
          >
            {c.nombre}
            {c.fija ? (
              <span className="ml-auto text-xs text-ac-neblina">siempre</span>
            ) : null}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
