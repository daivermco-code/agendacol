/** Archivo de calendario (.ics) de una cita, hecho en el navegador: sirve para Google, Apple y Outlook. */

/** Fecha y hora "de reloj" de una zona → instante UTC (dos pasadas por si la zona cambia de horario). */
export function aUtc(fecha: string, hora: string, zona: string): Date {
  const [a, m, d] = fecha.split("-").map(Number);
  const [h, min] = hora.split(":").map(Number);
  const deseado = Date.UTC(a, m - 1, d, h, min);
  let instante = deseado;
  for (let i = 0; i < 2; i++) instante = deseado - desfase(instante, zona);
  return new Date(instante);
}

/** Cuánto adelanta (ms) el reloj de la zona respecto a UTC en ese instante. */
function desfase(instante: number, zona: string): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instante));
  const v = (tipo: string) =>
    Number(partes.find((p) => p.type === tipo)?.value);
  const reloj = Date.UTC(
    v("year"),
    v("month") - 1,
    v("day"),
    v("hour"),
    v("minute"),
    v("second"),
  );
  return reloj - Math.floor(instante / 1000) * 1000;
}

/** 20261207T150000Z */
function marca(fecha: Date): string {
  return fecha
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** Texto seguro para un campo del calendario (RFC 5545). */
function escapar(texto: string): string {
  return texto
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Corta las líneas largas a 75 caracteres, como pide el formato. */
function doblar(linea: string): string {
  const partes: string[] = [];
  for (let i = 0; i < linea.length; i += 74)
    partes.push((i ? " " : "") + linea.slice(i, i + 74));
  return partes.join("\r\n");
}

export interface EventoCita {
  uid: string;
  fecha: string;
  inicio: string;
  fin: string;
  zona: string;
  titulo: string;
  lugar?: string | null;
  descripcion?: string;
}

export function crearIcs(e: EventoCita, ahora: Date = new Date()): string {
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AgendaCol//Demo//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${marca(ahora)}`,
    `DTSTART:${marca(aUtc(e.fecha, e.inicio, e.zona))}`,
    `DTEND:${marca(aUtc(e.fecha, e.fin, e.zona))}`,
    `SUMMARY:${escapar(e.titulo)}`,
    ...(e.lugar ? [`LOCATION:${escapar(e.lugar)}`] : []),
    ...(e.descripcion ? [`DESCRIPTION:${escapar(e.descripcion)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lineas.map(doblar).join("\r\n") + "\r\n";
}

/** Enlace de búsqueda en el mapa (sin llave): abre la app de mapas en el celular. */
export function enlaceMapa(direccion: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
}
