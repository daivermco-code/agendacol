import "server-only";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import type { EstadisticasRecordatorios } from "../types";

const VACIO = {
  enviados: 0,
  confirmadas: 0,
  ingresos: 0,
  noEnviados: 0,
  programados: 0,
};

/** Recordatorios de las citas del período, con la sesión de quien mira (RLS). */
export async function estadisticasRecordatorios(periodo: {
  desde: string;
  hasta: string;
}): Promise<EstadisticasRecordatorios> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("estadisticas_recordatorios", {
    p_desde: periodo.desde,
    p_hasta: periodo.hasta,
  });
  if (error) throw new Error(error.message);
  const e = data as unknown as EstadisticasRecordatorios;
  return {
    ...e,
    canales: {
      correo: e.canales?.correo ?? VACIO,
      whatsapp: e.canales?.whatsapp ?? VACIO,
    },
  };
}
