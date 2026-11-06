/** Números de un canal en el período (estadisticas_recordatorios, supabase/migrations/0008). */
export interface CanalRecordatorios {
  enviados: number;
  confirmadas: number;
  ingresos: number;
  noEnviados: number;
  programados: number;
}

export interface ReservaSinRecordatorio {
  id: string;
  fecha: string;
  hora: string;
  cliente: string;
  servicio: string;
  profesional: string;
  motivo: string;
}

export interface EstadisticasRecordatorios {
  reservas: number;
  confirmadas: number;
  asistidas: number;
  ingresosConfirmados: number;
  porEquipo: number;
  canales: { correo: CanalRecordatorios; whatsapp: CanalRecordatorios };
  sinRecordatorio: number;
  reservasSinRecordatorio: ReservaSinRecordatorio[];
  cupo: { contratados: number; usados: number; vence: string };
}
