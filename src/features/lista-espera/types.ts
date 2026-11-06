import type { Franja } from "./lib/franjas";

export type EstadoEspera = "esperando" | "avisado" | "quitado";

export interface FilaEspera {
  id: string;
  fecha: string;
  franja: Franja;
  estado: EstadoEspera;
  avisadoAt: string | null;
  creadaAt: string;
  clienteId: string;
  cliente: string;
  telefono: string | null;
  servicios: string;
  profesional: string | null;
}
