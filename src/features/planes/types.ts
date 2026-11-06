/** Plan o membresía del catálogo (Administración → Planes). sesiones null = citas sin límite. */
export interface Plan {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  vigenciaDias: number;
  sesiones: number | null;
  servicios: string[];
  activo: boolean;
  vendidos: number;
}

export type TipoBono = "plan" | "sesiones" | "paquete";
export type EstadoBono = "activo" | "agotado" | "vencido" | "anulado";

/** Lo que un cliente tiene comprado: plan, sesiones o paquete (listar_bonos, supabase/migrations/0009). */
export interface Bono {
  id: string;
  tipo: TipoBono;
  nombre: string;
  clienteId: string;
  cliente: string;
  servicios: string[];
  cupo: number | null;
  usadas: number;
  inicio: string;
  vence: string;
  venta: string | null;
  estado: EstadoBono;
}
