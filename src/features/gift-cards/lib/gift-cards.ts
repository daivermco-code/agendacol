import type { ColorGiftCard, EstadoGiftCard } from "../types";

/** Fondo de cada diseño (los mismos tonos de los gráficos; el texto va en blanco). */
export const FONDO_GIFT_CARD: Record<ColorGiftCard, string> = {
  laguna: "#0C8379",
  coral: "#BA501D",
  violeta: "#6250D6",
  noche: "#16233A",
};

export const COLORES_GIFT_CARD: { id: ColorGiftCard; nombre: string }[] = [
  { id: "laguna", nombre: "Laguna" },
  { id: "coral", nombre: "Coral" },
  { id: "violeta", nombre: "Violeta" },
  { id: "noche", nombre: "Noche" },
];

export const ESTADO_GIFT_CARD: Record<
  EstadoGiftCard,
  { nombre: string; clase: string }
> = {
  sin_usar: {
    nombre: "Sin usar",
    clase: "bg-ac-laguna-claro text-ac-laguna-hondo",
  },
  en_uso: { nombre: "Con saldo", clase: "bg-ac-info-fondo text-ac-info" },
  usada: { nombre: "Usada", clase: "bg-ac-niebla-oscura text-ac-pizarra" },
  vencida: { nombre: "Vencida", clase: "bg-ac-aviso-fondo text-ac-aviso" },
  anulada: { nombre: "Anulada", clase: "bg-ac-error-fondo text-ac-error" },
};

/** Estado de una gift card vendida a la fecha `hoy` (yyyy-MM-dd). */
export function estadoGiftCard(
  g: { anulada: boolean; vence: string; saldo: number; saldoInicial: number },
  hoy: string,
): EstadoGiftCard {
  if (g.anulada) return "anulada";
  if (g.saldo === 0) return "usada";
  if (g.vence < hoy) return "vencida";
  return g.saldo < g.saldoInicial ? "en_uso" : "sin_usar";
}
