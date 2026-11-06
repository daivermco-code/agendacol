import type { EstadoBono, TipoBono } from "../types";

export const NOMBRE_TIPO_BONO: Record<TipoBono, string> = {
  plan: "Plan",
  sesiones: "Sesiones",
  paquete: "Paquete",
};

export const ESTADO_BONO: Record<
  EstadoBono,
  { nombre: string; clase: string }
> = {
  activo: {
    nombre: "Activo",
    clase: "bg-ac-laguna-claro text-ac-laguna-hondo",
  },
  agotado: { nombre: "Agotado", clase: "bg-ac-niebla-oscura text-ac-pizarra" },
  vencido: { nombre: "Vencido", clase: "bg-ac-aviso-fondo text-ac-aviso" },
  anulado: { nombre: "Anulado", clase: "bg-ac-error-fondo text-ac-error" },
};

/** Estado a la fecha `hoy` (yyyy-MM-dd): anulado, vencido, agotado (sin cupo) o activo. */
export function estadoBono(
  b: { anulado: boolean; vence: string; cupo: number | null; usadas: number },
  hoy: string,
): EstadoBono {
  if (b.anulado) return "anulado";
  if (b.vence < hoy) return "vencido";
  if (b.cupo !== null && b.usadas >= b.cupo) return "agotado";
  return "activo";
}

/** "3 de 4 citas" o "5 citas (sin límite)". */
export function textoUso(b: { cupo: number | null; usadas: number }): string {
  if (b.cupo === null)
    return `${b.usadas} ${b.usadas === 1 ? "cita" : "citas"} (sin límite)`;
  return `${b.usadas} de ${b.cupo} ${b.cupo === 1 ? "cita" : "citas"}`;
}
