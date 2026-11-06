import "server-only";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import { hhmm } from "@/shared/lib/formato";
import type { ValoresAjustes } from "../schemas";

export async function obtenerAjustes(): Promise<ValoresAjustes | null> {
  const supabase = await crearClienteServidor();
  const [{ data: a }, { data: n }] = await Promise.all([
    supabase.from("ajustes").select("*").maybeSingle(),
    supabase.from("negocios").select("nombre, slug, descripcion").maybeSingle(),
  ]);
  if (!a || !n) return null;
  return {
    nombre: n.nombre,
    slug: n.slug,
    descripcion: n.descripcion ?? "",
    bloqueMin: a.bloque_min,
    permitirSobrepuestas: a.permitir_sobrepuestas,
    permitirClienteDoble: a.permitir_cliente_doble,
    permitirSobrecargaRecursos: a.permitir_sobrecarga_recursos,
    exigirContacto: a.exigir_contacto,
    bloquearPasadas: a.bloquear_pasadas,
    permitirFueraHorario: a.permitir_fuera_horario,
    avisoCorreo: a.aviso_correo,
    avisoWhatsapp: a.aviso_whatsapp,
    recordatorioCorreo: a.recordatorio_correo,
    recordatorioCorreoDias: a.recordatorio_correo_dias,
    recordatorioCorreoHora: hhmm(a.recordatorio_correo_hora),
    recordatorioWhatsapp: a.recordatorio_whatsapp,
    recordatorioWhatsappDias: a.recordatorio_whatsapp_dias,
    recordatorioWhatsappHora: hhmm(a.recordatorio_whatsapp_hora),
    cajaActiva: a.caja_activa,
    cajaClienteObligatorio: a.caja_cliente_obligatorio,
    webAnticipacionMin: a.web_anticipacion_min,
    webDiasMax: a.web_dias_max,
    webClienteCancela: a.web_cliente_cancela,
    webClienteCambia: a.web_cliente_cambia,
    webLimiteHoras: a.web_limite_horas,
    webPolitica: a.web_politica,
    redInstagram: a.red_instagram ?? "",
    redFacebook: a.red_facebook ?? "",
    redTiktok: a.red_tiktok ?? "",
    avisoEquipoReserva: a.aviso_equipo_reserva,
    avisoEquipoCambios: a.aviso_equipo_cambios,
    avisoEquipoCorreo: a.aviso_equipo_correo ?? "",
  };
}
