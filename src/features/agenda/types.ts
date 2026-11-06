import type { DiaHorario } from "@/features/administracion/schemas";
import type { EstadoCita } from "./lib/estados";

export interface LocalAgenda {
  id: string;
  nombre: string;
  zona: string;
  horario: DiaHorario[];
}

export interface ProfesionalAgenda {
  id: string;
  nombre: string;
  color: string;
  fotoUrl: string | null;
  localId: string;
  activo: boolean;
  horario: DiaHorario[];
}

export interface ServicioAgenda {
  id: string;
  nombre: string;
  categoria: string;
  duracionMin: number;
  precio: number;
  /** Profesionales que lo hacen. */
  profesionales: string[];
  /** Recursos que usa (vacío = ninguno). */
  recursos: string[];
}

/** Sala, silla o equipo de un local. */
export interface RecursoAgenda {
  id: string;
  nombre: string;
  localId: string;
}

/** Una clase del catálogo (servicio de tipo clase) con su cupo de siempre. */
export interface ClaseCatalogo extends ServicioAgenda {
  cupo: number;
}

/** Ajustes de agenda que la ventana de reserva usa antes de guardar. */
export interface AjustesReserva {
  exigirContacto: boolean;
  avisoCorreo: boolean;
  avisoWhatsapp: boolean;
}

/** Lo que la agenda necesita una sola vez (se lee en el servidor). */
export interface BaseAgenda {
  negocioId: string;
  slug: string;
  bloqueMin: number;
  locales: LocalAgenda[];
  profesionales: ProfesionalAgenda[];
  /** Lo que se agenda como cita (servicios y servicios con sesiones). */
  servicios: ServicioAgenda[];
  clases: ClaseCatalogo[];
  /** Recursos activos de todos los locales. */
  recursos: RecursoAgenda[];
  ajustes: AjustesReserva;
}

export interface CitaAgenda {
  id: string;
  profesionalId: string;
  servicioId: string;
  clienteId: string | null;
  clienteNombre: string;
  clienteTelefono: string | null;
  clienteCorreo: string | null;
  servicioNombre: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  /** Minutos desde medianoche. */
  inicio: number;
  fin: number;
  duracionMin: number;
  estado: EstadoCita;
  origen: string;
  precio: number;
  notaCliente: string | null;
  notaInterna: string | null;
  serieId: string | null;
  profesionalFijo: boolean;
  avisoCorreo: boolean;
  avisoWhatsapp: boolean;
  /** Cuándo se creó el cliente (etiqueta "Nuevo cliente" si tiene menos de 14 días). */
  clienteDesde: string | null;
  motivoCancelacion: string | null;
  /** Venta vigente de la cita ("$" verde si está pagada; ámbar si tiene saldo). */
  ventaId: string | null;
  pagada: boolean;
  pagoParcial: boolean;
  /** Plan del cliente que cubre la cita (sale en $0). */
  bonoId: string | null;
  bonoNombre: string | null;
  recursoId: string | null;
}

export interface BloqueoAgenda {
  id: string;
  profesionalId: string;
  motivo: string;
  inicio: string;
  fin: string;
  serieId: string | null;
}

/** Un bloqueo recortado a un día. */
export interface BloqueoDia {
  id: string;
  profesionalId: string;
  motivo: string;
  fecha: string;
  inicio: number;
  fin: number;
}

/** Una sesión de clase: ocupa al profesional y la llenan varios clientes hasta el cupo. */
export interface ClaseAgenda {
  id: string;
  servicioId: string;
  profesionalId: string;
  servicioNombre: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  /** Minutos desde medianoche. */
  inicio: number;
  fin: number;
  cupo: number;
  precio: number;
  nota: string | null;
  cancelada: boolean;
  inscritos: number;
}

export interface DatosAgenda {
  citas: CitaAgenda[];
  bloqueos: BloqueoAgenda[];
  clases: ClaseAgenda[];
}

/** Lo que se pide al tocar un hueco o "Nuevo". */
export interface PedidoNuevo {
  tipo: "reserva" | "bloqueo" | "clase";
  fecha?: string;
  minuto?: number;
  profesionalId?: string | null;
  /** Hueco de la vista por recursos: la reserva abre con ese recurso. */
  recursoId?: string | null;
  /** Búsqueda rápida de hora: la ventana abre con el servicio elegido. */
  servicio?: { id: string; duracionMin: number; precio: number };
  /** "Nueva reserva" desde la ficha del cliente: la ventana abre con él puesto. */
  cliente?: {
    id: string;
    nombre: string;
    correo: string | null;
    telefono: string | null;
    creado: string | null;
  };
}
