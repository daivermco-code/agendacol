import type { ClienteResumen } from "@/features/clientes/schemas";
import type { Database } from "@/types/database";

export type EstadoVenta = Database["public"]["Enums"]["estado_venta"];
export type TipoMetodo =
  | "efectivo"
  | "transferencia"
  | "debito"
  | "credito"
  | "billetera"
  | "gift_card"
  | "otro";
export type TipoServicio = "servicio" | "sesiones" | "clase" | "paquete";

export interface ServicioVenta {
  id: string;
  nombre: string;
  precio: number;
  duracionMin: number;
  categoria: string | null;
  tipo: TipoServicio;
  /** Sesiones que trae (servicio con sesiones) o servicios que incluye (paquete). */
  sesiones: number | null;
}

/** Gift card del catálogo: lo que se carga (monto) y lo que se cobra (precio). */
export interface GiftCardVenta {
  id: string;
  nombre: string;
  monto: number;
  precio: number;
  vigenciaDias: number;
}

/** Plan o membresía a la venta: sesiones null = sin límite. */
export interface PlanVenta {
  id: string;
  nombre: string;
  precio: number;
  vigenciaDias: number;
  sesiones: number | null;
}

export interface ProductoVenta {
  id: string;
  nombre: string;
  precio: number;
  existencias: number;
  categoria: string | null;
}

export interface MetodoVenta {
  id: string;
  nombre: string;
  tipo: TipoMetodo;
}

/** Un ítem del panel (la clave es local: dos cortes iguales son dos filas). */
export interface ItemPanel {
  clave: string;
  servicioId: string | null;
  productoId: string | null;
  planId: string | null;
  giftCardModeloId: string | null;
  citaId: string | null;
  profesionalId: string | null;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  fecha: string | null;
  hora: string | null;
}

/** Venta en "Pago parcial" que se termina de pagar. */
export interface SaldoVenta {
  id: string;
  numero: string;
  total: number;
  pagado: number;
  detalle: string;
}

/** Lo que el panel necesita al abrirse. */
export interface DatosPanel {
  localId: string;
  locales: { id: string; nombre: string }[];
  servicios: ServicioVenta[];
  /** Productos a la venta con sus existencias (los agotados salen sin poder agregarse). */
  productos: ProductoVenta[];
  giftCards: GiftCardVenta[];
  planes: PlanVenta[];
  profesionales: { id: string; nombre: string; color: string }[];
  metodos: MetodoVenta[];
  clienteObligatorio: boolean;
  /** Servicios más vendidos en los últimos 30 días (atajo "Recientes"). */
  recientes: string[];
  cliente: ClienteResumen | null;
  items: ItemPanel[];
  saldo: SaldoVenta | null;
  hoy: string;
  /** Citas que no entraron: ya cobradas o canceladas. */
  avisos: string[];
}

/** Lo que devuelve la base al cobrar (cerrar_venta y pagar_saldo). */
export interface CobroHecho {
  ventaId: string;
  numero: string;
  vuelto: number;
  estado: EstadoVenta;
  total: number;
  pagado: number;
  /** Gift cards que dejó la venta, con el código para entregar. */
  giftCards: { codigo: string; nombre: string; saldo: number; vence: string }[];
}

export type ResultadoCobro =
  | { ok: true; cobro: CobroHecho }
  | { ok: false; error: string; campo?: string; code?: string };

export interface DetalleVenta {
  id: string;
  numero: string;
  fecha: string;
  estado: EstadoVenta;
  cliente: {
    id: string;
    nombre: string;
    correo: string | null;
    telefono: string | null;
  } | null;
  items: {
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    total: number;
    profesional: string | null;
    cita: string | null;
  }[];
  pagos: {
    fecha: string;
    metodo: string;
    monto: number;
    recibido: number | null;
    comprobante: string | null;
    abono: boolean;
  }[];
  subtotal: number;
  descuento: number;
  total: number;
  pagado: number;
  creadaPor: string | null;
  motivoAnulacion: string | null;
  anuladaAt: string | null;
  anuladaPor: string | null;
}
