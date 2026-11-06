import { aHora } from "@/features/agenda/lib/fechas";

/** Historia de Instagram/WhatsApp: 1080 × 1920 (9:16). */
export const ANCHO = 1080;
export const ALTO = 1920;

/** Los 7 colores de la historia (propios de AgendaCol). */
export const COLORES = [
  { nombre: "Laguna", valor: "#0B7A70" },
  { nombre: "Noche", valor: "#13233A" },
  { nombre: "Azul", valor: "#206DB5" },
  { nombre: "Verde", valor: "#2F7D4F" },
  { nombre: "Ámbar", valor: "#A86A12" },
  { nombre: "Coral", valor: "#C4472B" },
  { nombre: "Fucsia", valor: "#B4236B" },
] as const;

export type Estilo = "claro" | "oscuro";

export interface DatosHistoria {
  /** "mañana" o "el sábado". */
  cuando: string;
  inicio: number;
  fin: number;
  /** Profesionales con un hueco dentro de la franja. */
  profesionales: number;
  negocio: string;
  /** Nombre de la sede, si el negocio tiene más de una. */
  sede: string | null;
  /** Enlace de reserva sin "https://". */
  enlace: string;
}

/** "14:00 – 19:00". */
export const textoFranja = (inicio: number, fin: number) =>
  `${aHora(inicio)} – ${aHora(fin)}`;

/** "1 profesional libre" / "3 profesionales libres". */
export const textoProfesionales = (n: number) =>
  n === 1 ? "1 profesional libre" : `${n} profesionales libres`;

/** "1 hora libre" / "5 horas libres" (redondea hacia abajo, mínimo 1). */
export function textoHoras(minutos: number): string {
  const h = Math.max(1, Math.floor(minutos / 60));
  return h === 1 ? "1 hora libre" : `${h} horas libres`;
}

/** Mezcla un color con blanco (t = 0 → color, 1 → blanco) o con otro color. */
export function mezclar(hex: string, con: string, t: number): string {
  const a = aRgb(hex);
  const b = aRgb(con);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function aRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Colores de cada estilo: fondo, mancha, texto principal, texto suave y acento. */
export function paleta(color: string, estilo: Estilo) {
  return estilo === "claro"
    ? {
        fondo: mezclar(color, "#FFFFFF", 0.92),
        mancha: mezclar(color, "#FFFFFF", 0.55),
        texto: mezclar(color, "#000000", 0.55),
        suave: mezclar(color, "#000000", 0.25),
        acento: color,
        pildora: "#FFFFFF",
        textoPildora: mezclar(color, "#000000", 0.45),
      }
    : {
        fondo: mezclar(color, "#000000", 0.7),
        mancha: color,
        texto: "#FFFFFF",
        suave: mezclar(color, "#FFFFFF", 0.7),
        acento: mezclar(color, "#FFFFFF", 0.6),
        pildora: "#FFFFFF",
        textoPildora: mezclar(color, "#000000", 0.45),
      };
}

/** Dibuja la historia en un canvas de 1080 × 1920. `letra` es la familia de la app (Figtree). */
export function dibujarHistoria(
  ctx: CanvasRenderingContext2D,
  d: DatosHistoria,
  color: string,
  estilo: Estilo,
  letra: string,
) {
  const p = paleta(color, estilo);
  const centro = ANCHO / 2;
  ctx.save();
  ctx.clearRect(0, 0, ANCHO, ALTO);
  ctx.fillStyle = p.fondo;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  // Dos manchas suaves del color elegido, arriba a la derecha y abajo a la izquierda.
  mancha(ctx, ANCHO * 0.95, ALTO * 0.08, 620, p.mancha, 0.55);
  mancha(ctx, ANCHO * 0.05, ALTO * 0.92, 720, p.mancha, 0.6);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = p.acento;
  ctx.font = `700 40px ${letra}`;
  espaciado(ctx, "HORAS LIBRES", centro, 640, 10);

  ctx.fillStyle = p.texto;
  ctx.font = `600 64px ${letra}`;
  ctx.fillText(`Tenemos espacio ${d.cuando}`, centro, 760, ANCHO - 120);

  ctx.font = `800 150px ${letra}`;
  ctx.fillText(textoFranja(d.inicio, d.fin), centro, 960, ANCHO - 100);

  // Píldora blanca con las horas libres.
  const textoP = `${textoProfesionales(d.profesionales)} · reserva la tuya`;
  ctx.font = `600 44px ${letra}`;
  const anchoP = Math.min(ANCHO - 120, ctx.measureText(textoP).width + 96);
  ctx.fillStyle = p.pildora;
  redondeado(ctx, centro - anchoP / 2, 1040, anchoP, 104, 52);
  ctx.fill();
  ctx.fillStyle = p.textoPildora;
  ctx.fillText(textoP, centro, 1108, anchoP - 48);

  ctx.fillStyle = p.suave;
  ctx.font = `500 44px ${letra}`;
  ctx.fillText("Reserva tu hora en", centro, 1290);
  ctx.fillStyle = p.texto;
  ctx.font = `700 48px ${letra}`;
  ctx.fillText(d.enlace, centro, 1360, ANCHO - 120);

  ctx.fillStyle = p.texto;
  ctx.font = `700 52px ${letra}`;
  ctx.fillText(d.negocio, centro, ALTO - 190, ANCHO - 120);
  if (d.sede) {
    ctx.fillStyle = p.suave;
    ctx.font = `500 40px ${letra}`;
    ctx.fillText(d.sede, centro, ALTO - 130, ANCHO - 120);
  }
  ctx.restore();
}

function mancha(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radio: number,
  color: string,
  opacidad: number,
) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radio);
  g.addColorStop(0, color);
  g.addColorStop(1, `${color}00`);
  ctx.globalAlpha = opacidad;
  ctx.fillStyle = g;
  ctx.fillRect(x - radio, y - radio, radio * 2, radio * 2);
  ctx.globalAlpha = 1;
}

/** Texto centrado con letras espaciadas (sin `letterSpacing`, que no todos los navegadores tienen). */
function espaciado(
  ctx: CanvasRenderingContext2D,
  texto: string,
  centro: number,
  y: number,
  espacio: number,
) {
  const letras = [...texto];
  const anchos = letras.map((l) => ctx.measureText(l).width);
  const total =
    anchos.reduce((s, w) => s + w, 0) + espacio * (letras.length - 1);
  let x = centro - total / 2;
  const alinear = ctx.textAlign;
  ctx.textAlign = "left";
  letras.forEach((l, i) => {
    ctx.fillText(l, x, y);
    x += anchos[i] + espacio;
  });
  ctx.textAlign = alinear;
}

function redondeado(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ancho: number,
  alto: number,
  radio: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radio, y);
  ctx.arcTo(x + ancho, y, x + ancho, y + alto, radio);
  ctx.arcTo(x + ancho, y + alto, x, y + alto, radio);
  ctx.arcTo(x, y + alto, x, y, radio);
  ctx.arcTo(x, y, x + ancho, y, radio);
  ctx.closePath();
}
