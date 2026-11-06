import type { Franja } from "@/features/lista-espera/lib/franjas";
import type { CitaPublica } from "@/features/reserva-publica/types";

export type CitaResumen = CitaPublica["proximas"][number];

export interface EsperaCliente {
  id: string;
  fecha: string;
  franja: Franja;
  estado: "esperando" | "avisado";
  profesional: string | null;
  servicios: string;
  /** Paso de hora con los servicios, el profesional y el día ya elegidos. */
  enlace: string;
}

export interface MisCitas {
  negocio: { nombre: string; slug: string; logo: string | null };
  cliente: string | null;
  /** Correo o celular con el que entró, a medias ("an•••@ejemplo.test"). */
  destino: string;
  proximas: CitaResumen[];
  historial: CitaResumen[];
  esperas: EsperaCliente[];
}
