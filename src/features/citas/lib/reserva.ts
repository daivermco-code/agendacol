import type { EstadoCita } from "@/features/agenda/lib/estados";
import { aHora, aMinutos, diaSemana } from "@/features/agenda/lib/fechas";
import { abiertosDelDia } from "@/features/agenda/lib/horario";
import type {
  AjustesReserva,
  CitaAgenda,
  LocalAgenda,
  PedidoNuevo,
  ServicioAgenda,
} from "@/features/agenda/types";
import type { Repetir } from "../schemas";

/** El cliente elegido en la reserva (nombre completo y contacto para la tarjeta). */
export interface ClienteElegido {
  id: string;
  nombre: string;
  correo: string | null;
  telefono: string | null;
  creado: string | null;
}

/** Estado de la ventana de reserva antes de validar. */
export interface FormReserva {
  id?: string;
  serieId: string | null;
  estado: EstadoCita;
  fecha: string;
  hora: string;
  repetir: Repetir | null;
  omitir: string[];
  cliente: ClienteElegido | null;
  profesionalId: string;
  profesionalFijo: boolean;
  servicioId: string;
  /** Vacío = automático (el primero libre si el servicio usa recursos). */
  recursoId: string;
  duracionMin: number;
  precio: number;
  notaCliente: string;
  notaInterna: string;
  avisoCorreo: boolean;
  avisoWhatsapp: boolean;
}

/** Hora sugerida para "Nuevo": la del hueco, la próxima media hora de hoy o la apertura del local. */
export function horaSugerida(
  pedido: PedidoNuevo,
  local: LocalAgenda,
  hoy: { fecha: string; minutos: number },
  fecha: string,
): string {
  if (pedido.minuto !== undefined) return aHora(pedido.minuto);
  if (fecha === hoy.fecha)
    return aHora(
      Math.min(Math.ceil((hoy.minutos + 1) / 30) * 30, 23 * 60 + 30),
    );
  const dia = local.horario.find((d) => d.dia === diaSemana(fecha));
  const abierto = dia ? abiertosDelDia(dia)[0] : undefined;
  return aHora(abierto?.inicio ?? 9 * 60);
}

export function formNuevo(
  pedido: PedidoNuevo,
  local: LocalAgenda,
  hoy: { fecha: string; minutos: number },
  ajustes: AjustesReserva,
): FormReserva {
  const fecha = pedido.fecha ?? hoy.fecha;
  return {
    serieId: null,
    estado: "reservado",
    fecha,
    hora: horaSugerida(pedido, local, hoy, fecha),
    repetir: null,
    omitir: [],
    cliente: pedido.cliente ?? null,
    profesionalId: pedido.profesionalId ?? "",
    profesionalFijo: false,
    servicioId: pedido.servicio?.id ?? "",
    recursoId: pedido.recursoId ?? "",
    duracionMin: pedido.servicio?.duracionMin ?? 0,
    precio: pedido.servicio?.precio ?? 0,
    notaCliente: "",
    notaInterna: "",
    avisoCorreo: ajustes.avisoCorreo,
    avisoWhatsapp: ajustes.avisoWhatsapp,
  };
}

export function formDeCita(c: CitaAgenda): FormReserva {
  return {
    id: c.id,
    serieId: c.serieId,
    estado: c.estado === "cancelado" ? "reservado" : c.estado,
    fecha: c.fecha,
    hora: c.horaInicio,
    repetir: null,
    omitir: [],
    cliente: c.clienteId
      ? {
          id: c.clienteId,
          nombre: c.clienteNombre,
          correo: c.clienteCorreo,
          telefono: c.clienteTelefono,
          creado: c.clienteDesde,
        }
      : null,
    profesionalId: c.profesionalId,
    profesionalFijo: c.profesionalFijo,
    servicioId: c.servicioId,
    recursoId: c.recursoId ?? "",
    duracionMin: c.duracionMin,
    precio: c.precio,
    notaCliente: c.notaCliente ?? "",
    notaInterna: c.notaInterna ?? "",
    avisoCorreo: c.avisoCorreo,
    avisoWhatsapp: c.avisoWhatsapp,
  };
}

/** Lo que se manda a `guardarCita` (la validación final la hace el esquema en el servidor). */
export function aDatosCita(f: FormReserva, localId: string) {
  return {
    id: f.id,
    localId,
    clienteId: f.cliente?.id ?? "",
    profesionalId: f.profesionalId,
    servicioId: f.servicioId,
    recursoId: f.recursoId || null,
    fecha: f.fecha,
    horaInicio: f.hora,
    duracionMin: f.duracionMin,
    precio: f.precio,
    estado: f.estado,
    profesionalFijo: f.profesionalFijo,
    notaCliente: f.notaCliente,
    notaInterna: f.notaInterna,
    avisoCorreo: f.avisoCorreo && Boolean(f.cliente?.correo),
    avisoWhatsapp: f.avisoWhatsapp && Boolean(f.cliente?.telefono),
    repetir: f.id ? null : f.repetir,
    omitir: f.omitir,
  };
}

/** Lo mismo para mover una cita a otra fecha, hora o profesional. */
export function datosMovida(
  c: CitaAgenda,
  localId: string,
  destino: { fecha: string; inicio: number; profesionalId: string },
) {
  return aDatosCita(
    {
      ...formDeCita(c),
      estado: c.estado,
      fecha: destino.fecha,
      hora: aHora(destino.inicio),
      profesionalId: destino.profesionalId,
    },
    localId,
  );
}

/** Servicios que hace un profesional (todos si el servicio no tiene profesionales asignados). */
export function serviciosDe(
  servicios: ServicioAgenda[],
  profesionalId: string,
): ServicioAgenda[] {
  if (!profesionalId) return [];
  return servicios.filter(
    (s) =>
      s.profesionales.length === 0 || s.profesionales.includes(profesionalId),
  );
}

/** "10:30" + 45 → "11:15"; vacío si falta algo o pasa de la medianoche. */
export function horaFin(hora: string, duracion: number): string {
  if (!/^\d{2}:\d{2}$/.test(hora) || duracion <= 0) return "";
  const fin = aMinutos(hora) + duracion;
  return fin > 24 * 60 ? "" : aHora(fin === 24 * 60 ? 1439 : fin);
}

/** Lo que falta para poder guardar (los botones se apagan hasta tenerlo). */
export function faltante(f: FormReserva): string | null {
  if (!f.cliente) return "Elige un cliente";
  if (!f.profesionalId) return "Elige un profesional";
  if (!f.servicioId) return "Elige un servicio";
  return null;
}
