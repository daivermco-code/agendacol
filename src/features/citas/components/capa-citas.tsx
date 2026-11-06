"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePuede } from "@/features/auth/components/proveedor-miembro";
import { toast } from "sonner";
import { claseNueva } from "@/features/clases/lib/clases";
import { useClases } from "@/features/clases/store/clases";
import { usePanelVenta } from "@/features/ventas/store/panel-venta";
import type {
  BaseAgenda,
  CitaAgenda,
  DatosAgenda,
  LocalAgenda,
  PedidoNuevo,
  ProfesionalAgenda,
} from "@/features/agenda/types";
import { useCambiarEstado, useMoverCita } from "../hooks/use-acciones-cita";
import {
  formDeCita,
  formNuevo,
  horaSugerida,
  type FormReserva,
} from "../lib/reserva";
import { FichaFlotante } from "./ficha-cita";
import {
  bloqueoDe,
  bloqueoNuevo,
  VentanaBloqueo,
  type FormBloqueo,
} from "./ventana-bloqueo";
import { VentanaCancelar } from "./ventana-cancelar";
import { VentanaReserva } from "./ventana-reserva";

interface Opciones {
  base: BaseAgenda;
  local: LocalAgenda | null;
  hoy: { fecha: string; minutos: number };
  /** Fecha para "Nuevo" cuando no se tocó un hueco. */
  fechaVista: string;
  profesionalVista: ProfesionalAgenda | null;
  activos: ProfesionalAgenda[];
  datos: DatosAgenda | undefined;
  esCelular: boolean;
}

/**
 * Todo lo que se abre sobre la agenda: ventana de reserva, ficha flotante, cancelar, bloqueo y los
 * choques al mover. Devuelve los manejadores para la cuadrícula y las ventanas para pintar.
 */
export function useCapaCitas(o: Opciones) {
  const puedo = usePuede();
  const abrirVenta = usePanelVenta((e) => e.abrir);
  const verVenta = usePanelVenta((e) => e.ver);
  const volverACita = usePanelVenta((e) => e.volverACita);
  const limpiarVuelta = usePanelVenta((e) => e.limpiarVuelta);
  const editarClase = useClases((e) => e.editar);
  const [reserva, setReserva] = useState<FormReserva | null>(null);
  const [bloqueo, setBloqueo] = useState<FormBloqueo | null>(null);
  const [ficha, setFicha] = useState<{ id: string; rect: DOMRect } | null>(
    null,
  );
  const [cancelar, setCancelar] = useState<CitaAgenda | null>(null);
  /** Dónde estaba la ficha al cobrar, para abrirla igual con "Volver a la cita". */
  const ultimoRect = useRef<DOMRect | null>(null);
  const estado = useCambiarEstado();
  const nombres = useMemo(
    () => new Map(o.base.profesionales.map((p) => [p.id, p.nombre])),
    [o.base.profesionales],
  );
  const { mover, ventana: choquesAlMover } = useMoverCita(
    o.local?.id ?? "",
    nombres,
  );
  const { base, local, hoy, fechaVista, profesionalVista, datos } = o;

  const nuevo = useCallback(
    (p: PedidoNuevo) => {
      if (!local) return;
      const pedido = {
        ...p,
        fecha: p.fecha ?? fechaVista,
        profesionalId: p.profesionalId ?? profesionalVista?.id ?? null,
      };
      if (p.tipo === "bloqueo") {
        const hora = horaSugerida(pedido, local, hoy, pedido.fecha);
        setBloqueo(
          bloqueoNuevo(pedido.fecha, hora, pedido.profesionalId ?? ""),
        );
      } else if (p.tipo === "clase") {
        const clase = base.clases[0];
        if (!clase) {
          toast.info(
            "Primero crea una clase en Administración → Servicios → Clases.",
          );
          return;
        }
        const hora = horaSugerida(pedido, local, hoy, pedido.fecha);
        editarClase(
          claseNueva(clase, local.id, pedido.fecha, hora, pedido.profesionalId),
        );
      } else setReserva(formNuevo(pedido, local, hoy, base.ajustes));
    },
    [fechaVista, profesionalVista, local, hoy, base, editarClase],
  );
  const abrirCita = useCallback((c: CitaAgenda, el: HTMLElement) => {
    ultimoRect.current = el.getBoundingClientRect();
    setFicha({ id: c.id, rect: ultimoRect.current });
  }, []);
  // "Volver a la cita" desde el comprobante: abre otra vez la ficha, ya cobrada.
  useEffect(() => {
    if (!volverACita) return;
    setFicha({ id: volverACita, rect: ultimoRect.current ?? new DOMRect() });
    limpiarVuelta();
  }, [volverACita, limpiarVuelta]);
  const puedeBloquear = puedo("bloquear_horario");
  const abrirBloqueo = useMemo(
    () =>
      puedeBloquear
        ? (id: string) => {
            const b = datos?.bloqueos.find((x) => x.id === id);
            if (b) setBloqueo(bloqueoDe(b));
          }
        : undefined,
    [puedeBloquear, datos],
  );
  const editar = useCallback((c: CitaAgenda) => {
    setFicha(null);
    setReserva(formDeCita(c));
  }, []);
  const eliminar = useCallback((c: CitaAgenda) => {
    setFicha(null);
    setCancelar(c);
  }, []);

  const citaFicha = ficha
    ? datos?.citas.find((c) => c.id === ficha.id)
    : undefined;
  const ventanas = (
    <>
      {reserva && local ? (
        <VentanaReserva
          base={base}
          localId={local.id}
          inicial={reserva}
          onCerrar={() => setReserva(null)}
        />
      ) : null}
      {bloqueo ? (
        <VentanaBloqueo
          inicial={bloqueo}
          profesionales={o.activos}
          onCerrar={() => setBloqueo(null)}
        />
      ) : null}
      {cancelar ? (
        <VentanaCancelar cita={cancelar} onCerrar={() => setCancelar(null)} />
      ) : null}
      {ficha && citaFicha ? (
        <FichaFlotante
          rect={ficha.rect}
          esCelular={o.esCelular}
          cita={citaFicha}
          profesional={base.profesionales.find(
            (p) => p.id === citaFicha.profesionalId,
          )}
          recurso={
            base.recursos.find((r) => r.id === citaFicha.recursoId)?.nombre
          }
          puedeEditar={puedo("crear_cita")}
          verContacto={puedo("ver_contactos")}
          onEstado={(e) => estado.mutate({ cita: citaFicha, estado: e })}
          onEditar={() => editar(citaFicha)}
          onEliminar={() => eliminar(citaFicha)}
          onCerrar={() => setFicha(null)}
          onPagar={
            puedo("cobrar")
              ? () => {
                  setFicha(null);
                  abrirVenta(
                    citaFicha.pagoParcial && citaFicha.ventaId
                      ? { ventaId: citaFicha.ventaId }
                      : { citaIds: [citaFicha.id] },
                    { tipo: "cita", citaId: citaFicha.id },
                  );
                }
              : undefined
          }
          onVerVenta={
            puedo("ver_ventas") && citaFicha.ventaId
              ? () => {
                  setFicha(null);
                  verVenta(citaFicha.ventaId);
                }
              : undefined
          }
        />
      ) : null}
      {choquesAlMover}
    </>
  );

  return {
    nuevo,
    abrirCita,
    abrirBloqueo,
    mover: puedo("crear_cita") ? mover : undefined,
    editar,
    eliminar,
    ventanas,
  };
}
