"use client";

import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { historialProducto } from "../actions";
import type { Producto, TipoMovimientoStock } from "../types";

const NOMBRES: Record<TipoMovimientoStock, string> = {
  entrada: "Entrada",
  venta: "Venta",
  anulacion: "Anulación",
  ajuste: "Conteo",
};

/** Los últimos movimientos de un producto: entradas, ventas, anulaciones y conteos, con quién los hizo. */
export function HistorialProducto({
  producto,
  onCerrar,
}: {
  producto: Producto;
  onCerrar: () => void;
}) {
  const consulta = useQuery({
    queryKey: ["historial-producto", producto.id],
    queryFn: () => historialProducto(producto.id),
  });
  const r = consulta.data;
  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Historial de existencias</DialogTitle>
          <DialogDescription>
            {producto.nombre} · hay{" "}
            <span className="cifras font-semibold">{producto.existencias}</span>
          </DialogDescription>
        </DialogHeader>
        {consulta.isPending ? (
          <p className="flex items-center gap-2 py-6 text-sm text-ac-pizarra">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{" "}
            Cargando…
          </p>
        ) : !r?.ok ? (
          <p className="py-6 text-sm text-ac-error">
            {r?.error ?? "No se pudo leer el historial"}
          </p>
        ) : r.datos.length === 0 ? (
          <p className="py-6 text-sm text-ac-pizarra">
            Aún no tiene movimientos.
          </p>
        ) : (
          <ul className="max-h-[60vh] divide-y divide-ac-borde overflow-y-auto text-sm">
            {r.datos.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {NOMBRES[m.tipo]}
                    {m.nota ? (
                      <span className="font-normal text-ac-pizarra">
                        {" "}
                        · {m.nota}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-ac-neblina">
                    {format(parseISO(m.fecha), "d MMM yyyy · HH:mm", {
                      locale: es,
                    })}
                    {m.quien ? ` · ${m.quien}` : ""}
                  </span>
                </span>
                <span
                  className={cn(
                    "cifras shrink-0 font-semibold",
                    m.cantidad > 0 ? "text-ac-exito" : "text-ac-tinta",
                  )}
                >
                  {m.cantidad > 0 ? "+" : "−"}
                  {Math.abs(m.cantidad)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
