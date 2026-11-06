/** Lo que devuelven las funciones publico_* de la base (sitio de reservas y enlace del cliente). */

export interface ServicioPublico {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string;
  duracion: number;
  mostrarDuracion: boolean;
  /** null si el negocio no muestra el precio. */
  precio: number | null;
  imagen: string | null;
}

export interface ProfesionalPublico {
  id: string;
  nombre: string;
  foto: string | null;
  color: string | null;
  /** Ids de los servicios que hace. */
  servicios: string[];
}

export interface HorarioDia {
  /** 1 = lunes … 7 = domingo. */
  dia: number;
  abierto: boolean;
  inicio: string;
  fin: string;
}

/** Reglas del sitio (Ajustes → Sitio web). */
export interface ReglasSitio {
  /** Desde cuántos minutos después de ahora se puede reservar. */
  anticipacionMin: number;
  /** Hasta cuántos días adelante. */
  diasMax: number;
  politica: string | null;
  /** El cliente cambia o cancela desde su enlace hasta estas horas antes (0 = hasta la hora). */
  limiteHoras: number;
  cancela: boolean;
  cambia: boolean;
}

export interface Portada {
  reglas: ReglasSitio;
  redes: {
    instagram: string | null;
    facebook: string | null;
    tiktok: string | null;
  };
  negocio: {
    nombre: string;
    descripcion: string | null;
    logo: string | null;
    slug: string;
  };
  local: {
    nombre: string;
    direccion: string | null;
    telefono: string | null;
    whatsapp: boolean;
    portada: string | null;
    zona: string;
    recibeReservas: boolean;
  };
  horario: HorarioDia[];
  servicios: ServicioPublico[];
  profesionales: ProfesionalPublico[];
}

/** Un día del paso "Fecha y hora". */
export interface DiaLibre {
  fecha: string;
  abierto: boolean;
  horas: string[];
}

export type EstadoCitaPublica =
  | "reservado"
  | "confirmado"
  | "asiste"
  | "no_asistio"
  | "pendiente"
  | "en_espera"
  | "cancelado";

export interface CitaPublica {
  token: string;
  estado: EstadoCitaPublica;
  fecha: string;
  inicio: string;
  fin: string;
  duracion: number;
  cliente: string;
  /** Texto para el cliente; la nota interna del equipo no sale de la base. */
  avisoCancelacion: string | null;
  servicios: {
    nombre: string;
    inicio: string;
    fin: string;
    precio: number | null;
  }[];
  profesional: { nombre: string; foto: string | null; color: string | null };
  negocio: { nombre: string; slug: string; logo: string | null };
  local: {
    nombre: string;
    direccion: string | null;
    telefono: string | null;
    zona: string;
  };
  /** Futura y sin cancelar: todavía se puede ir. */
  activa: boolean;
  reglas: Pick<
    ReglasSitio,
    "cancela" | "cambia" | "limiteHoras" | "diasMax" | "politica"
  >;
  puedeConfirmar: boolean;
  puedeCambiar: boolean;
  puedeCancelar: boolean;
  puedeCalificar: boolean;
  calificacion: { estrellas: number; comentario: string | null } | null;
  proximas: {
    token: string;
    fecha: string;
    inicio: string;
    servicio: string;
    profesional: string;
    estado: EstadoCitaPublica;
  }[];
}

/** Respuesta de las funciones que cambian algo. */
export type RespuestaPublica =
  | { ok: true; token?: string }
  | { ok: false; error: { code: string; message: string; field?: string } };
