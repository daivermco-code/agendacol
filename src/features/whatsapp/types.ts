export interface Plantilla {
  id: string;
  nombre: string;
  cuerpo: string;
  activo: boolean;
}

/** Plantilla ya llenada con los datos de una cita, para elegir en su ficha. */
export interface MensajeCita {
  id: string;
  nombre: string;
  texto: string;
}
