import { cn } from "@/shared/lib/utils";
import type { EstadoVenta } from "../types";

export const ESTADO_VENTA: Record<
  EstadoVenta,
  { nombre: string; clase: string }
> = {
  pagada: { nombre: "Pagada", clase: "bg-ac-exito-fondo text-ac-exito" },
  parcial: { nombre: "Pago parcial", clase: "bg-ac-aviso-fondo text-ac-aviso" },
  anulada: { nombre: "Anulada", clase: "bg-ac-niebla-oscura text-ac-pizarra" },
};

export function PildoraVenta({
  estado,
  className,
}: {
  estado: EstadoVenta;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        ESTADO_VENTA[estado].clase,
        className,
      )}
    >
      {ESTADO_VENTA[estado].nombre}
    </span>
  );
}
