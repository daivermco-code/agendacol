import type { ProductoBajo } from "@/features/reportes/services/reportes";
import type { FranjaLibre, Meta } from "./lib/tablero";

export type Sugerencia =
  | {
      tipo: "horas";
      /** Día de las horas libres ('YYYY-MM-DD'). */
      fecha: string;
      /** "mañana" o "el sábado". */
      cuando: string;
      franja: FranjaLibre;
      /** Para el enlace de reserva (/reservar/<slug>). */
      slug: string;
      /** Nombre de la sede, si el negocio tiene más de una. */
      sede: string | null;
    }
  | { tipo: "clientes"; cantidad: number; dias: number };

/** Lo que muestra el Inicio del celular (T-12.9). null = el rol no lo ve. */
export interface DatosTablero {
  semana: { reservasNuevas: number; ingresos: number | null };
  meta: Meta;
  indicadores: {
    /** % de clientes que volvieron en los últimos 90 días. */
    retencion: number | null;
    ingresoEstimado: number | null;
    clientesNuevos: number;
    ticketPromedio: number | null;
    /** Si el rol ve plata (ingreso estimado y ticket promedio). */
    ventas: boolean;
  };
  origen: { agenda: number; enLinea: number };
  sugerencia: Sugerencia | null;
  stock: ProductoBajo[] | null;
}
