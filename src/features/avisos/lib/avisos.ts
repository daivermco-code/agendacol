/** Lo que pasó en el negocio y conviene saber (T-12.10). Sale de lo que ya está en la base, sin tabla propia. */
export type TipoAviso =
  | "reserva"
  | "cancelacion"
  | "espera"
  | "espera_avisada"
  | "pago"
  | "stock"
  | "respuesta";

export type Categoria = "reservas" | "pagos" | "sistema";
export type Ficha = "todos" | "no_leidos" | Categoria;

export interface Aviso {
  id: string;
  tipo: TipoAviso;
  /** Cuándo pasó (ISO con zona). */
  fecha: string;
  titulo: string;
  detalle: string;
  /** Pantalla que lo muestra. */
  enlace: string;
}

export const CATEGORIA: Record<TipoAviso, Categoria> = {
  reserva: "reservas",
  cancelacion: "reservas",
  espera: "reservas",
  espera_avisada: "sistema",
  pago: "pagos",
  stock: "sistema",
  respuesta: "sistema",
};

export const FICHAS: { valor: Ficha; nombre: string }[] = [
  { valor: "todos", nombre: "Todos" },
  { valor: "no_leidos", nombre: "No leídos" },
  { valor: "reservas", nombre: "Reservas" },
  { valor: "pagos", nombre: "Pagos" },
  { valor: "sistema", nombre: "Sistema" },
];

const ms = (iso: string) => new Date(iso).getTime();

/** ¿Pasó después de la última vez que se vieron los avisos? Sin fecha guardada, todo es nuevo. */
export function esNuevo(a: Aviso, visto: string | null): boolean {
  return visto === null || ms(a.fecha) > ms(visto);
}

export function contarNuevos(avisos: Aviso[], visto: string | null): number {
  return avisos.filter((a) => esNuevo(a, visto)).length;
}

/** Fecha del aviso más nuevo (la que se guarda como "visto"); null sin avisos. */
export function masNuevo(avisos: Aviso[]): string | null {
  let mejor: string | null = null;
  for (const a of avisos)
    if (mejor === null || ms(a.fecha) > ms(mejor)) mejor = a.fecha;
  return mejor;
}

export function filtrar(
  avisos: Aviso[],
  ficha: Ficha,
  visto: string | null,
): Aviso[] {
  if (ficha === "todos") return avisos;
  if (ficha === "no_leidos") return avisos.filter((a) => esNuevo(a, visto));
  return avisos.filter((a) => CATEGORIA[a.tipo] === ficha);
}

/** 'YYYY-MM-DD' de un instante en la zona del negocio. */
export function diaEnZona(iso: string, zona = "America/Bogota"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(
    new Date(iso),
  );
}

function diaAnterior(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export interface Grupo {
  titulo: "Hoy" | "Ayer" | "Antes";
  avisos: Aviso[];
}

/** Más nuevos primero, en grupos Hoy, Ayer y Antes (los vacíos no salen). */
export function agrupar(avisos: Aviso[], hoy: string): Grupo[] {
  const ayer = diaAnterior(hoy);
  const grupos: Grupo[] = [
    { titulo: "Hoy", avisos: [] },
    { titulo: "Ayer", avisos: [] },
    { titulo: "Antes", avisos: [] },
  ];
  for (const a of [...avisos].sort((x, y) => ms(y.fecha) - ms(x.fecha))) {
    const dia = diaEnZona(a.fecha);
    const g = dia >= hoy ? 0 : dia === ayer ? 1 : 2;
    grupos[g].avisos.push(a);
  }
  return grupos.filter((g) => g.avisos.length > 0);
}

const MESES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/** "Hace un momento", "Hace 5 min", "Hace 3 h", "Ayer" o "2 nov". */
export function cuandoFue(iso: string, ahora: Date): string {
  const minutos = Math.floor((ahora.getTime() - ms(iso)) / 60_000);
  const hoy = diaEnZona(ahora.toISOString());
  const dia = diaEnZona(iso);
  if (dia === hoy) {
    if (minutos < 1) return "Hace un momento";
    if (minutos < 60) return `Hace ${minutos} min`;
    return `Hace ${Math.floor(minutos / 60)} h`;
  }
  if (dia === diaAnterior(hoy)) return "Ayer";
  const [, m, d] = dia.split("-").map(Number);
  return `${d} ${MESES[m - 1]}`;
}
