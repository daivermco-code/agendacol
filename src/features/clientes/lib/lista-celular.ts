/** Lo que la lista de Clientes del celular muestra de cada cliente. */
export interface ClienteLista {
  id: string;
  nombre: string;
  apellido: string;
  correo: string | null;
}

export interface GrupoLetra {
  letra: string;
  clientes: ClienteLista[];
}

/** Letra de sección: la primera del nombre, sin tilde y en mayúscula (la Ñ con la N, como ordena la base); lo que no es letra va en "#". */
export function letraDe(nombre: string): string {
  const primera = nombre
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .charAt(0)
    .toUpperCase();
  return /^[A-Z]$/.test(primera) ? primera : "#";
}

/**
 * Agrupa por letra en el orden en que llegan (la base ya ordena por nombre). Si una letra vuelve a salir más
 * abajo (otro orden de la base), se suma a su grupo en vez de repetir la sección.
 */
export function agruparPorLetra(clientes: ClienteLista[]): GrupoLetra[] {
  const grupos = new Map<string, ClienteLista[]>();
  for (const c of clientes) {
    const letra = letraDe(c.nombre);
    const grupo = grupos.get(letra);
    if (grupo) grupo.push(c);
    else grupos.set(letra, [c]);
  }
  return [...grupos].map(([letra, lista]) => ({ letra, clientes: lista }));
}

/** Colores claros con texto oscuro (contraste de 6,3 : 1 o más, AA; en noche, al revés); sin morado (DESIGN.md). */
export const COLORES_INICIALES = [
  { fondo: "var(--inicial-rosa-fondo)", texto: "var(--inicial-rosa-texto)" }, // rosa
  {
    fondo: "var(--inicial-durazno-fondo)",
    texto: "var(--inicial-durazno-texto)",
  }, // durazno
  { fondo: "var(--inicial-menta-fondo)", texto: "var(--inicial-menta-texto)" }, // menta
  { fondo: "var(--inicial-cielo-fondo)", texto: "var(--inicial-cielo-texto)" }, // cielo
  { fondo: "var(--inicial-ambar-fondo)", texto: "var(--inicial-ambar-texto)" }, // ámbar
  {
    fondo: "var(--inicial-laguna-fondo)",
    texto: "var(--inicial-laguna-texto)",
  }, // laguna
] as const;

/** El mismo cliente siempre con el mismo color (en la lista y en su ficha). */
export function colorDe(id: string): (typeof COLORES_INICIALES)[number] {
  let suma = 0;
  for (const c of id) suma = (suma * 31 + c.charCodeAt(0)) >>> 0;
  return COLORES_INICIALES[suma % COLORES_INICIALES.length];
}

/** "Cliente desde el 31/10/2026" con la fecha de Bogotá. */
export function clienteDesde(creado: string): string {
  const dia = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(creado));
  return `Cliente desde el ${dia}`;
}
