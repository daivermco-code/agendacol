/** Filtro guardado de una audiencia (lo lee audiencia_clientes en la base). Las claves que faltan no filtran. */
export interface FiltroAudiencia {
  genero?: "femenino" | "masculino" | "otro";
  /** 1..12, o 0 = el mes en curso (sirve para "cumpleaños de este mes" todos los meses). */
  cumpleMes?: number;
  servicioId?: string;
  sinVenirDias?: number;
  nuevosDias?: number;
}

export const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

export const SIN_VENIR = [
  { dias: 21, nombre: "3 semanas" },
  { dias: 30, nombre: "1 mes" },
  { dias: 60, nombre: "2 meses" },
  { dias: 90, nombre: "3 meses" },
] as const;

export const NUEVOS = [
  { dias: 7, nombre: "la última semana" },
  { dias: 30, nombre: "el último mes" },
  { dias: 90, nombre: "los últimos 3 meses" },
] as const;

const GENERO = {
  femenino: "Mujeres",
  masculino: "Hombres",
  otro: "Otro género",
};

/** "Mujeres · cumpleaños en el mes en curso · no vienen hace 1 mes" (o "Todos los clientes"). */
export function describirFiltro(
  f: FiltroAudiencia,
  servicios: ReadonlyArray<{ id: string; nombre: string }>,
): string {
  const partes: string[] = [];
  if (f.genero) partes.push(GENERO[f.genero]);
  if (f.cumpleMes !== undefined)
    partes.push(
      f.cumpleMes === 0
        ? "cumpleaños en el mes en curso"
        : `cumpleaños en ${MESES[f.cumpleMes - 1]}`,
    );
  if (f.servicioId) {
    const s = servicios.find((x) => x.id === f.servicioId);
    partes.push(`han tomado ${s?.nombre ?? "un servicio que ya no existe"}`);
  }
  if (f.sinVenirDias) {
    const t = SIN_VENIR.find((x) => x.dias === f.sinVenirDias);
    partes.push(`no vienen hace ${t?.nombre ?? `${f.sinVenirDias} días`}`);
  }
  if (f.nuevosDias) {
    const t = NUEVOS.find((x) => x.dias === f.nuevosDias);
    partes.push(`llegaron ${t?.nombre ?? `hace ${f.nuevosDias} días`}`);
  }
  if (!partes.length) return "Todos los clientes";
  const texto = partes.join(" · ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** El texto tal como le llega a un cliente: {nombre} se cambia por su nombre. */
export function conNombre(texto: string, nombre: string): string {
  return texto.replaceAll("{nombre}", nombre);
}
