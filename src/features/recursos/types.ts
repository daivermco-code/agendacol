export interface Recurso {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  localId: string;
  localNombre: string;
  /** Servicios que lo usan. */
  servicios: string[];
  /** Citas de hoy en adelante que lo ocupan. */
  proximas: number;
}

export interface ServicioRecurso {
  id: string;
  nombre: string;
  categoria: string;
}

export interface LocalRecurso {
  id: string;
  nombre: string;
}
