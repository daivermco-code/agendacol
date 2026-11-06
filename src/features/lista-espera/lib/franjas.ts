/** Parte del día en la que el cliente quiere la hora (antes o después de las 12:00). */
export type Franja = "dia" | "manana" | "tarde";

export const FRANJAS: Record<Franja, string> = {
  dia: "Todo el día",
  manana: "En la mañana",
  tarde: "En la tarde",
};
