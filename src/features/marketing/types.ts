import type { FiltroAudiencia } from "./lib/audiencias";

export interface Conteo {
  /** Clientes que cumplen el filtro. */
  total: number;
  /** Los que recibirían el correo (tienen correo y no lo suprimieron). */
  reciben: number;
  sinCorreo: number;
  suprimidos: number;
}

export interface Cupo {
  usados: number;
  cupo: number;
}

export interface Audiencia {
  id: string;
  nombre: string;
  filtro: FiltroAudiencia;
  conteo: Conteo;
}

export interface Campana {
  id: string;
  audienciaId: string | null;
  asunto: string;
  cuerpo: string;
  estado: "borrador" | "enviada";
  destinatarios: number | null;
  enviadaAt: string | null;
  creada: string;
}

export interface ClienteSuprimido {
  id: string;
  nombre: string;
  correo: string;
}

export interface ServicioFiltro {
  id: string;
  nombre: string;
}
