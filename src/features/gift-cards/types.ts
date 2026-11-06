export type ColorGiftCard = "laguna" | "coral" | "violeta" | "noche";

/** Gift card del catálogo (Administración → Gift cards). */
export interface ModeloGiftCard {
  id: string;
  nombre: string;
  monto: number;
  precio: number;
  vigenciaDias: number;
  color: ColorGiftCard;
  activo: boolean;
  vendidas: number;
}

export type EstadoGiftCard =
  "sin_usar" | "en_uso" | "usada" | "vencida" | "anulada";

/** Gift card vendida (listar_gift_cards, supabase/migrations/0009). */
export interface GiftCardVendida {
  id: string;
  codigo: string;
  nombre: string;
  comprador: string | null;
  para: string | null;
  saldoInicial: number;
  saldo: number;
  vence: string;
  venta: string | null;
  usos: number;
  creada: string;
  estado: EstadoGiftCard;
}
