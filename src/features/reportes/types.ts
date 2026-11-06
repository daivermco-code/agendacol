import type { EstadoCita } from "@/features/agenda/lib/estados";

/** Lo que devuelve estadisticas_reservas (supabase/migrations/0007). Días ISO: 1 = lunes … 7 = domingo. */
export interface EstadisticasReservas {
  total: number;
  activas: number;
  porEstado: Partial<Record<EstadoCita, number>>;
  porOrigen: { agenda: number; enLinea: number };
  minutosReservados: number;
  minutosDisponibles: number;
  asistencias: number;
  inasistencias: number;
  atendido: number;
  nuevosClientes: number;
  clientesPrimeraVez: number;
  clientesRecurrentes: number;
  porDia: {
    dia: number;
    reservas: number;
    minutosReservados: number;
    minutosDisponibles: number;
  }[];
  porHora: { dia: number; hora: number; reservas: number }[];
  porFecha: { fecha: string; reservas: number; atendido: number }[];
  servicios: { nombre: string; reservas: number; atendido: number }[];
  clientes: {
    id: string;
    nombre: string;
    reservas: number;
    atendido: number;
  }[];
  profesionales: {
    id: string;
    nombre: string;
    color: string | null;
    reservas: number;
    asistencias: number;
    inasistencias: number;
    canceladas: number;
    minutosReservados: number;
    minutosDisponibles: number;
    atendido: number;
  }[];
}

/** Lo que devuelve estadisticas_ventas: sin las anuladas; los ítems suman antes del descuento. */
export interface EstadisticasVentas {
  total: number;
  cantidad: number;
  descuentos: number;
  porCobrar: number;
  anuladas: number;
  porTipo: { servicios: number; productos: number; otros: number };
  porDia: { dia: number; total: number; cantidad: number }[];
  porFecha: { fecha: string; total: number; cantidad: number }[];
  categorias: { nombre: string; total: number; cantidad: number }[];
  servicios: { nombre: string; cantidad: number; total: number }[];
  productos: { nombre: string; cantidad: number; total: number }[];
  profesionales: {
    nombre: string;
    color: string | null;
    cantidad: number;
    total: number;
  }[];
}

export type Comparacion = "anterior" | "anio" | "ninguna";

/** Un período con su comparación ya calculada (null = sin comparar). */
export interface PeriodoReporte {
  desde: string;
  hasta: string;
  comparar: Comparacion;
  anterior: { desde: string; hasta: string } | null;
}
