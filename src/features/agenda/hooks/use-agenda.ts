"use client";

import { useEffect, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { crearClienteNavegador } from "@/shared/lib/supabase/client";
import { aMinutos, moverAncla, rangoDeVista, type Vista } from "../lib/fechas";
import type { CitaAgenda, DatosAgenda } from "../types";

type FilaCita = {
  id: string;
  profesional_id: string;
  servicio_id: string;
  cliente_id: string | null;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  cliente_correo: string | null;
  servicio_nombre: string | null;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  duracion_min: number;
  estado: CitaAgenda["estado"];
  origen: string;
  precio: number;
  nota_cliente: string | null;
  nota_interna: string | null;
  serie_id: string | null;
  profesional_fijo: boolean;
  aviso_correo: boolean;
  aviso_whatsapp: boolean;
  cliente_desde: string | null;
  motivo_cancelacion: string | null;
  venta_id: string | null;
  venta_estado: string | null;
  bono_id: string | null;
  bono_nombre: string | null;
  recurso_id: string | null;
};

function aCita(f: FilaCita): CitaAgenda {
  return {
    id: f.id,
    profesionalId: f.profesional_id,
    servicioId: f.servicio_id,
    clienteId: f.cliente_id,
    clienteNombre: f.cliente_nombre ?? "Sin cliente",
    clienteTelefono: f.cliente_telefono,
    clienteCorreo: f.cliente_correo,
    servicioNombre: f.servicio_nombre ?? "Servicio",
    fecha: f.fecha,
    horaInicio: f.hora_inicio.slice(0, 5),
    horaFin: f.hora_fin.slice(0, 5),
    inicio: aMinutos(f.hora_inicio),
    fin: aMinutos(f.hora_fin),
    duracionMin: f.duracion_min,
    estado: f.estado,
    origen: f.origen,
    precio: Number(f.precio),
    notaCliente: f.nota_cliente,
    notaInterna: f.nota_interna,
    serieId: f.serie_id,
    profesionalFijo: f.profesional_fijo,
    avisoCorreo: f.aviso_correo,
    avisoWhatsapp: f.aviso_whatsapp,
    clienteDesde: f.cliente_desde,
    motivoCancelacion: f.motivo_cancelacion,
    ventaId: f.venta_id,
    pagada: f.venta_estado === "pagada",
    pagoParcial: f.venta_estado === "parcial",
    bonoId: f.bono_id,
    bonoNombre: f.bono_nombre,
    recursoId: f.recurso_id,
  };
}

export const CLAVE_AGENDA = "agenda";

async function cargarAgenda(
  localId: string,
  desde: string,
  hasta: string,
): Promise<DatosAgenda> {
  const supabase = crearClienteNavegador();
  const despues = format(addDays(parseISO(hasta), 1), "yyyy-MM-dd");
  const [citas, clases, bloqueos] = await Promise.all([
    supabase.rpc("agenda_citas", {
      p_local: localId,
      p_desde: desde,
      p_hasta: hasta,
    }),
    supabase.rpc("agenda_clases", {
      p_local: localId,
      p_desde: desde,
      p_hasta: hasta,
    }),
    supabase
      .from("bloqueos")
      .select("id, profesional_id, motivo, inicio, fin, serie_id")
      .lt("inicio", `${despues}T00:00:00`)
      .gt("fin", `${desde}T00:00:00`)
      .order("inicio"),
  ]);
  if (citas.error) throw new Error(citas.error.message);
  if (bloqueos.error) throw new Error(bloqueos.error.message);
  if (clases.error) throw new Error(clases.error.message);
  return {
    citas: (citas.data as FilaCita[]).map(aCita),
    bloqueos: bloqueos.data.map((b) => ({
      id: b.id,
      profesionalId: b.profesional_id,
      motivo: b.motivo,
      inicio: b.inicio,
      fin: b.fin,
      serieId: b.serie_id,
    })),
    clases: clases.data
      .filter((k) => !k.cancelada)
      .map((k) => ({
        id: k.id,
        servicioId: k.servicio_id,
        profesionalId: k.profesional_id,
        servicioNombre: k.servicio_nombre,
        fecha: k.fecha,
        horaInicio: k.hora_inicio.slice(0, 5),
        horaFin: k.hora_fin.slice(0, 5),
        inicio: aMinutos(k.hora_inicio),
        fin: aMinutos(k.hora_fin),
        cupo: k.cupo,
        precio: k.precio,
        nota: k.nota,
        cancelada: k.cancelada,
        inscritos: k.inscritos,
      })),
  };
}

function opciones(localId: string, desde: string, hasta: string) {
  return {
    queryKey: [CLAVE_AGENDA, localId, desde, hasta] as const,
    queryFn: () => cargarAgenda(localId, desde, hasta),
  };
}

/** Citas y bloqueos del rango visible; precarga el rango anterior y el siguiente. */
export function useAgenda(localId: string, vista: Vista, ancla: string) {
  const qc = useQueryClient();
  const { desde, hasta } = rangoDeVista(vista, ancla);
  const consulta = useQuery({
    ...opciones(localId, desde, hasta),
    placeholderData: keepPreviousData,
    // Respaldo del canal en vivo: con el tope de mensajes por segundo, Realtime pierde avisos sin cortar el
    // canal (no hay reconexión que refresque). Solo corre con la pestaña visible.
    refetchInterval: 60_000,
    enabled: Boolean(localId),
  });

  useEffect(() => {
    if (!localId) return;
    for (const paso of [-1, 1] as const) {
      const r = rangoDeVista(vista, moverAncla(vista, ancla, paso));
      void qc.prefetchQuery(opciones(localId, r.desde, r.hasta));
    }
  }, [qc, localId, vista, ancla]);

  return consulta;
}

/** Escucha cambios de citas y bloqueos del negocio y refresca la agenda. Devuelve si la conexión está viva. */
export function useEnVivo(negocioId: string): boolean {
  const qc = useQueryClient();
  const [enVivo, setEnVivo] = useState(true);

  useEffect(() => {
    const supabase = crearClienteNavegador();
    const refrescar = () =>
      void qc.invalidateQueries({ queryKey: [CLAVE_AGENDA] });
    const filtro = `negocio_id=eq.${negocioId}`;
    let canal: RealtimeChannel | null = null;
    let activo = true;

    // Sin el token del usuario el canal entra como anónimo y RLS no le deja ver ningún cambio.
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!activo) return;
      await supabase.realtime.setAuth(data.session?.access_token ?? null);
      if (!activo) return;
      canal = supabase
        .channel(`agenda-${negocioId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "citas", filter: filtro },
          refrescar,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "bloqueos", filter: filtro },
          refrescar,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "clases", filter: filtro },
          refrescar,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "clase_inscritos",
            filter: filtro,
          },
          refrescar,
        )
        // SUBSCRIBED llega al unirse y otra vez tras cada reconexión: lo que cambió antes de unirse o
        // mientras el canal estaba caído no llega como aviso, así que se vuelve a pedir la agenda.
        .subscribe((estado) => {
          if (estado === "SUBSCRIBED") {
            setEnVivo(true);
            refrescar();
          }
          if (estado === "CHANNEL_ERROR" || estado === "TIMED_OUT")
            setEnVivo(false);
        });
    })();

    return () => {
      activo = false;
      if (canal) void supabase.removeChannel(canal);
    };
  }, [qc, negocioId]);

  return enVivo;
}
