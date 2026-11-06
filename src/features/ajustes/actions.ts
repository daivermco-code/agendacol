"use server";

import { revalidatePath } from "next/cache";
import {
  miembroQuePuede,
  primerError,
  SIN_PERMISO,
} from "@/shared/lib/acciones";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import { ESQUEMAS, type SeccionEditable } from "./schemas";

type Resultado = { ok: true } | { ok: false; error: string; code?: string };

export async function guardarAjustes(
  seccion: SeccionEditable,
  entrada: unknown,
): Promise<Resultado> {
  const miembro = await miembroQuePuede("editar_ajustes");
  if (!miembro) return SIN_PERMISO;
  const esquema = ESQUEMAS[seccion];
  if (!esquema) return { ok: false, error: "Sección no válida" };
  const p = esquema.safeParse(entrada);
  if (!p.success) return primerError(p.error.issues);

  const supabase = await crearClienteServidor();
  let error: { code?: string } | null = null;

  if (seccion === "mi-negocio") {
    const d = ESQUEMAS["mi-negocio"].parse(p.data);
    ({ error } = await supabase
      .from("negocios")
      .update({
        nombre: d.nombre,
        slug: d.slug,
        descripcion: d.descripcion || null,
      })
      .eq("id", miembro.negocioId));
    if (error?.code === "23505")
      return { ok: false, error: "Esa dirección ya la usa otro negocio" };
  } else if (seccion === "agenda") {
    const d = ESQUEMAS.agenda.parse(p.data);
    ({ error } = await supabase
      .from("ajustes")
      .update({
        bloque_min: d.bloqueMin,
        permitir_sobrepuestas: d.permitirSobrepuestas,
        permitir_cliente_doble: d.permitirClienteDoble,
        permitir_sobrecarga_recursos: d.permitirSobrecargaRecursos,
        exigir_contacto: d.exigirContacto,
        bloquear_pasadas: d.bloquearPasadas,
        permitir_fuera_horario: d.permitirFueraHorario,
      })
      .eq("negocio_id", miembro.negocioId));
  } else if (seccion === "recordatorios") {
    const d = ESQUEMAS.recordatorios.parse(p.data);
    ({ error } = await supabase
      .from("ajustes")
      .update({
        aviso_correo: d.avisoCorreo,
        aviso_whatsapp: d.avisoWhatsapp,
        recordatorio_correo: d.recordatorioCorreo,
        recordatorio_correo_dias: d.recordatorioCorreoDias,
        recordatorio_correo_hora: d.recordatorioCorreoHora,
        recordatorio_whatsapp: d.recordatorioWhatsapp,
        recordatorio_whatsapp_dias: d.recordatorioWhatsappDias,
        recordatorio_whatsapp_hora: d.recordatorioWhatsappHora,
      })
      .eq("negocio_id", miembro.negocioId));
  } else if (seccion === "sitio-web") {
    const d = ESQUEMAS["sitio-web"].parse(p.data);
    ({ error } = await supabase
      .from("ajustes")
      .update({
        web_anticipacion_min: d.webAnticipacionMin,
        web_dias_max: d.webDiasMax,
        web_cliente_cancela: d.webClienteCancela,
        web_cliente_cambia: d.webClienteCambia,
        web_limite_horas: d.webLimiteHoras,
        web_politica: d.webPolitica,
      })
      .eq("negocio_id", miembro.negocioId));
  } else if (seccion === "avanzadas") {
    const d = ESQUEMAS.avanzadas.parse(p.data);
    ({ error } = await supabase
      .from("ajustes")
      .update({
        red_instagram: d.redInstagram || null,
        red_facebook: d.redFacebook || null,
        red_tiktok: d.redTiktok || null,
        aviso_equipo_reserva: d.avisoEquipoReserva,
        aviso_equipo_cambios: d.avisoEquipoCambios,
        aviso_equipo_correo: d.avisoEquipoCorreo || null,
      })
      .eq("negocio_id", miembro.negocioId));
  } else {
    const d = ESQUEMAS.caja.parse(p.data);
    ({ error } = await supabase
      .from("ajustes")
      .update({
        caja_activa: d.cajaActiva,
        caja_cliente_obligatorio: d.cajaClienteObligatorio,
      })
      .eq("negocio_id", miembro.negocioId));
  }

  if (error) return { ok: false, error: "No se pudieron guardar los ajustes" };
  revalidatePath("/", "layout");
  return { ok: true };
}
