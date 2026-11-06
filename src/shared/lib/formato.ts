const PESOS = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

/** $45.000 */
export function pesos(valor: number): string {
  return PESOS.format(valor).replace(/\s/g, "");
}

/** 45 min · 1 h · 1 h 30 min */
export function duracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Días ISO: 1 = lunes … 7 = domingo. */
export const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;

/** '09:00:00' → '09:00' */
export function hhmm(hora: string | null | undefined): string {
  return hora ? hora.slice(0, 5) : "";
}

/** +573001234567 → +57 300 123 4567 (otros países se dejan como están). */
export function telefono(valor: string | null | undefined): string {
  if (!valor) return "";
  const m = /^\+57(\d{3})(\d{3})(\d{4})$/.exec(valor);
  return m ? `+57 ${m[1]} ${m[2]} ${m[3]}` : valor;
}
