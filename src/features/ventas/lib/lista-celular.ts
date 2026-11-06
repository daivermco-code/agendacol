import { format } from "date-fns";
import { es } from "date-fns/locale";
import { TZDate } from "@date-fns/tz";
import { ZONA_LOCAL } from "@/features/agenda/lib/fechas";
import type { EstadoVenta, TipoMetodo } from "../types";

/** Una venta en la lista del celular. */
export interface VentaCelular {
  id: string;
  numero: string;
  /** created_at (ISO con zona). */
  fecha: string;
  total: number;
  pagado: number;
  estado: EstadoVenta;
  cliente: string | null;
  pagos: { monto: number; metodo: string; tipo: TipoMetodo }[];
}

/** Una propina en la pestaña Propinas. */
export interface PropinaCelular {
  id: string;
  fecha: string;
  propina: number;
  cliente: string | null;
  metodo: string;
  tipo: TipoMetodo;
  ventaId: string;
  numero: string;
}

export interface GrupoDia<T> {
  dia: string;
  /** "miércoles, 5 de noviembre" (con el año si no es el de hoy) */
  titulo: string;
  esHoy: boolean;
  total: number;
  filas: T[];
}

/** Día y hora de Bogotá de una fecha guardada en UTC. */
export function enBogota(fecha: string): { dia: string; hora: string } {
  const z = new TZDate(new Date(fecha), ZONA_LOCAL);
  return { dia: format(z, "yyyy-MM-dd"), hora: format(z, "HH:mm") };
}

/** El método que se muestra en la fila: el único usado, "Varios" o "Sin pago". */
export function metodoPrincipal(pagos: VentaCelular["pagos"]): {
  nombre: string;
  tipo: TipoMetodo | null;
} {
  const distintos = [...new Set(pagos.map((p) => p.metodo))];
  if (!distintos.length) return { nombre: "Sin pago", tipo: null };
  if (distintos.length > 1) return { nombre: "Varios", tipo: "otro" };
  return { nombre: pagos[0].metodo, tipo: pagos[0].tipo };
}

/** Agrupa por día de Bogotá (en el orden que llegan) con el total de cada día. */
export function agruparPorDia<T extends { fecha: string }>(
  filas: T[],
  hoy: string,
  valor: (t: T) => number,
): GrupoDia<T>[] {
  const grupos: GrupoDia<T>[] = [];
  for (const f of filas) {
    const { dia } = enBogota(f.fecha);
    let g = grupos.find((x) => x.dia === dia);
    if (!g) {
      g = {
        dia,
        titulo: format(
          new Date(`${dia}T12:00:00`),
          dia.slice(0, 4) === hoy.slice(0, 4)
            ? "EEEE, d 'de' MMMM"
            : "EEEE, d 'de' MMMM 'de' yyyy",
          { locale: es },
        ),
        esHoy: dia === hoy,
        total: 0,
        filas: [],
      };
      grupos.push(g);
    }
    g.total += valor(f);
    g.filas.push(f);
  }
  return grupos;
}

/** Lo que cuenta una venta en los totales: las anuladas no suman (como el resumen de la tableta). */
export const valorVenta = (v: VentaCelular) =>
  v.estado === "anulada" ? 0 : v.total;

/** Total grande y "N ventas" del período, sin las anuladas. */
export function resumenVentas(filas: VentaCelular[]): {
  total: number;
  n: number;
} {
  const vigentes = filas.filter((v) => v.estado !== "anulada");
  return {
    total: vigentes.reduce((s, v) => s + v.total, 0),
    n: vigentes.length,
  };
}
