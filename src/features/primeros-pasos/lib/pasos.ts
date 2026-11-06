/** Los 6 pasos para dejar listo el negocio. Cada uno señala, en su pantalla, el control `[data-guia=clave]`. */
export type ClavePaso =
  "horario" | "servicios" | "equipo" | "cita" | "sitio" | "venta";

export interface Paso {
  clave: ClavePaso;
  titulo: string;
  texto: string;
  ruta: string;
}

export const PASOS: readonly Paso[] = [
  {
    clave: "horario",
    titulo: "Revisa el horario del local",
    texto:
      "Marca qué días abres y a qué horas. La agenda y el sitio de reservas solo ofrecen horas dentro de ese horario.",
    ruta: "/administracion/locales",
  },
  {
    clave: "servicios",
    titulo: "Crea tus servicios",
    texto:
      "Cada servicio lleva su duración y su precio: con eso la agenda sabe cuándo termina la cita y cuánto cobrar.",
    ruta: "/administracion/servicios",
  },
  {
    clave: "equipo",
    titulo: "Suma a tu equipo",
    texto:
      "Agrega a quienes atienden, con su horario y los servicios que hacen. Cada profesional tiene su columna en la agenda.",
    ruta: "/administracion/profesionales",
  },
  {
    clave: "cita",
    titulo: "Agenda la primera cita",
    texto:
      "Toca una hora libre de la agenda o usa «Nuevo» para crear una cita, una clase o un bloqueo.",
    ruta: "/agenda",
  },
  {
    clave: "sitio",
    titulo: "Comparte tu sitio de reservas",
    texto:
      "Con el enlace, tus clientes eligen servicio, profesional y hora sin llamarte. Ábrelo para verlo o cópialo para compartirlo.",
    ruta: "/ajustes/sitio-web",
  },
  {
    clave: "venta",
    titulo: "Registra la primera venta",
    texto:
      "Cobra servicios, productos o gift cards y elige cómo te pagaron. La venta entra a la caja del día.",
    ruta: "/ventas/detalle",
  },
];

export const TOTAL_PASOS = PASOS.length;

/** La pantalla del paso `n` (1 a 6) con el globo del recorrido abierto. */
export function rutaDelPaso(n: number): string {
  return `${PASOS[n - 1].ruta}?guia=${n}`;
}
