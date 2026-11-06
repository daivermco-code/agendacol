import type { ProfesionalPublico, ServicioPublico } from "../types";

/** Lo que el cliente va eligiendo; viaja entre pasos en la dirección (s, p, f, h) para poder volver atrás. */
export interface Seleccion {
  lineas: Linea[];
  /** Profesional elegido; null = cualquiera. */
  profesionalId: string | null;
  fecha: string | null;
  hora: string | null;
}

export interface Linea {
  id: string;
  cantidad: number;
}

/** Lo mismo que acepta la base en una reserva (plan_reserva): hasta 6 servicios y 8 horas. */
export const MAX_UNIDADES = 6;
export const MAX_MINUTOS = 480;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FECHA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const HORA = /^([01]\d|2[0-3]):(00|30)$/;

/** "id:2,id:1" → líneas válidas de servicios que existen, sin pasar de MAX_UNIDADES. */
export function leerLineas(
  texto: string | undefined,
  servicios: ServicioPublico[],
): Linea[] {
  const existen = new Set(servicios.map((s) => s.id));
  const lineas: Linea[] = [];
  let unidades = 0;
  for (const parte of (texto ?? "").split(",")) {
    const [id, n] = parte.split(":");
    const cantidad = Math.min(Number(n) || 0, MAX_UNIDADES - unidades);
    if (!existen.has(id) || cantidad < 1 || lineas.some((l) => l.id === id))
      continue;
    lineas.push({ id, cantidad });
    unidades += cantidad;
  }
  return lineas;
}

export function escribirLineas(lineas: Linea[]): string {
  return lineas.map((l) => `${l.id}:${l.cantidad}`).join(",");
}

/** La selección completa desde los parámetros de la dirección (lo que no es válido se descarta). */
export function leerSeleccion(
  p: { s?: string; p?: string; f?: string; h?: string },
  servicios: ServicioPublico[],
): Seleccion {
  return {
    lineas: leerLineas(p.s, servicios),
    profesionalId: p.p && UUID.test(p.p) ? p.p : null,
    fecha: p.f && FECHA.test(p.f) ? p.f : null,
    hora: p.h && HORA.test(p.h) ? p.h : null,
  };
}

/** Dirección de un paso con la selección hasta ahí. */
export function enlacePaso(
  slug: string,
  paso: "" | "hora" | "datos",
  sel: Partial<Seleccion>,
): string {
  const q = new URLSearchParams();
  if (sel.lineas?.length) q.set("s", escribirLineas(sel.lineas));
  if (sel.profesionalId) q.set("p", sel.profesionalId);
  if (sel.fecha) q.set("f", sel.fecha);
  if (sel.hora) q.set("h", sel.hora);
  const ruta = `/reservar/${slug}${paso ? `/${paso}` : ""}`;
  const texto = q.toString();
  return texto ? `${ruta}?${texto}` : ruta;
}

/** Ids de servicio repetidos según la cantidad, en orden: lo que recibe la base. */
export function expandir(lineas: Linea[]): string[] {
  return lineas.flatMap((l) => Array<string>(l.cantidad).fill(l.id));
}

export function totales(lineas: Linea[], servicios: ServicioPublico[]) {
  let unidades = 0;
  let minutos = 0;
  let precio = 0;
  let precioCompleto = true;
  for (const l of lineas) {
    const s = servicios.find((x) => x.id === l.id);
    if (!s) continue;
    unidades += l.cantidad;
    minutos += s.duracion * l.cantidad;
    if (s.precio === null) precioCompleto = false;
    else precio += s.precio * l.cantidad;
  }
  return { unidades, minutos, precio, precioCompleto };
}

/** Profesionales que hacen todos los servicios elegidos (la reserva va con uno solo). */
export function profesionalesPara(
  lineas: Linea[],
  profesionales: ProfesionalPublico[],
): ProfesionalPublico[] {
  return profesionales.filter((p) =>
    lineas.every((l) => p.servicios.includes(l.id)),
  );
}

/** Horas en Mañana (antes de 12), Tarde (12 a 18) y Noche (desde las 18). */
export function agruparHoras(horas: string[]) {
  return {
    manana: horas.filter((h) => h < "12:00"),
    tarde: horas.filter((h) => h >= "12:00" && h < "18:00"),
    noche: horas.filter((h) => h >= "18:00"),
  };
}

/** "09:00" + 90 → "10:30". */
export function sumarMinutos(hora: string, minutos: number): string {
  const total =
    Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5)) + minutos;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
