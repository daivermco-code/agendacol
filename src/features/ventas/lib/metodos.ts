import {
  Banknote,
  CreditCard,
  Gift,
  Landmark,
  Smartphone,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { TipoMetodo } from "../types";

/** Ícono de cada tipo de método de pago (cobro, filas de Ventas y comprobante). */
export const ICONO_METODO: Record<TipoMetodo, LucideIcon> = {
  efectivo: Banknote,
  transferencia: Landmark,
  debito: CreditCard,
  credito: CreditCard,
  billetera: Smartphone,
  gift_card: Gift,
  otro: Wallet,
};
