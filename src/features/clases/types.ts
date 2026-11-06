import type { EstadoInscrito } from "./schemas";

/** Un cliente en la lista de una clase (inscritos_clase, supabase/migrations/0010). */
export interface Inscrito {
  id: string;
  clienteId: string;
  cliente: string;
  /** Solo para dueño y recepción. */
  telefono: string | null;
  estado: EstadoInscrito;
  bonoId: string | null;
  bonoNombre: string | null;
}
