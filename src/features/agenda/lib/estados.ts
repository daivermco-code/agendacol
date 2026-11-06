import type { Database } from "@/types/database";

export type EstadoCita = Database["public"]["Enums"]["estado_cita"];

interface ColorEstado {
  nombre: string;
  fondo: string;
  borde: string;
  texto: string;
}

/** Colores de DESIGN.md §2 (fondo · borde izquierdo · texto): variables de globals.css, con su versión de noche. */
export const ESTADOS: Record<EstadoCita, ColorEstado> = {
  reservado: {
    nombre: "Reservado",
    fondo: "var(--estado-reservado-fondo)",
    borde: "var(--estado-reservado-borde)",
    texto: "var(--estado-reservado-texto)",
  },
  confirmado: {
    nombre: "Confirmado",
    fondo: "var(--estado-confirmado-fondo)",
    borde: "var(--estado-confirmado-borde)",
    texto: "var(--estado-confirmado-texto)",
  },
  asiste: {
    nombre: "Asiste",
    fondo: "var(--estado-asiste-fondo)",
    borde: "var(--estado-asiste-borde)",
    texto: "var(--estado-asiste-texto)",
  },
  no_asistio: {
    nombre: "No asistió",
    fondo: "var(--estado-no-asistio-fondo)",
    borde: "var(--estado-no-asistio-borde)",
    texto: "var(--estado-no-asistio-texto)",
  },
  pendiente: {
    nombre: "Pendiente",
    fondo: "var(--estado-pendiente-fondo)",
    borde: "var(--estado-pendiente-borde)",
    texto: "var(--estado-pendiente-texto)",
  },
  en_espera: {
    nombre: "En espera",
    fondo: "var(--estado-en-espera-fondo)",
    borde: "var(--estado-en-espera-borde)",
    texto: "var(--estado-en-espera-texto)",
  },
  cancelado: {
    nombre: "Cancelado",
    fondo: "var(--estado-cancelado-fondo)",
    borde: "var(--estado-cancelado-borde)",
    texto: "var(--estado-cancelado-texto)",
  },
};

/** Orden de los puntos de estado en la ficha y en la leyenda. */
export const ORDEN_ESTADOS: EstadoCita[] = [
  "reservado",
  "confirmado",
  "asiste",
  "no_asistio",
  "pendiente",
  "en_espera",
  "cancelado",
];

/** Estados que se muestran por defecto ("Reservas activas"). */
export const ESTADOS_ACTIVOS: EstadoCita[] = ORDEN_ESTADOS.filter(
  (e) => e !== "cancelado",
);
