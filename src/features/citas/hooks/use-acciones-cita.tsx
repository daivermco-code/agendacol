"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  esErrorDeRed,
  mensajeDeError,
  SIN_RED_NO_GUARDO,
} from "@/shared/lib/red";
import { CLAVE_AGENDA } from "@/features/agenda/hooks/use-agenda";
import type { EstadoCita } from "@/features/agenda/lib/estados";
import { aHora } from "@/features/agenda/lib/fechas";
import type { CitaAgenda, DatosAgenda } from "@/features/agenda/types";
import { cambiarEstadoCita, guardarCita } from "../actions";
import { datosMovida } from "../lib/reserva";
import {
  VentanaChoques,
  type ChoquesPendientes,
} from "../components/ventana-choques";

type Copia = [QueryKey, DatosAgenda | undefined][];

/** Cambia una cita en todas las agendas en memoria y devuelve cómo estaban (para deshacer). */
async function cambiarEnMemoria(
  qc: QueryClient,
  citaId: string,
  cambio: Partial<CitaAgenda>,
): Promise<Copia> {
  await qc.cancelQueries({ queryKey: [CLAVE_AGENDA] });
  const antes = qc.getQueriesData<DatosAgenda>({ queryKey: [CLAVE_AGENDA] });
  qc.setQueriesData<DatosAgenda>({ queryKey: [CLAVE_AGENDA] }, (d) =>
    d
      ? {
          ...d,
          citas: d.citas.map((c) =>
            c.id === citaId ? { ...c, ...cambio } : c,
          ),
        }
      : d,
  );
  return antes;
}

/** La cita tal como está ahora en memoria (la agenda se actualiza en vivo). */
function citaEnMemoria(qc: QueryClient, id: string): CitaAgenda | undefined {
  for (const [, datos] of qc.getQueriesData<DatosAgenda>({
    queryKey: [CLAVE_AGENDA],
  })) {
    const c = datos?.citas.find((x) => x.id === id);
    if (c) return c;
  }
  return undefined;
}

function deshacer(qc: QueryClient, antes: Copia) {
  for (const [clave, datos] of antes) qc.setQueryData(clave, datos);
}

/** Estado con un clic desde la ficha: se ve al instante y vuelve atrás si la base no lo acepta. */
export function useCambiarEstado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      cita,
      estado,
    }: {
      cita: CitaAgenda;
      estado: EstadoCita;
    }) => {
      const r = await cambiarEstadoCita(cita.id, estado);
      if (!r.ok) throw new Error(r.error);
    },
    onMutate: async ({ cita, estado }) => ({
      antes: await cambiarEnMemoria(qc, cita.id, { estado }),
    }),
    onError: (e, _v, ctx) => {
      if (ctx) deshacer(qc, ctx.antes);
      toast.error(mensajeDeError(e));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: [CLAVE_AGENDA] }),
  });
}

export interface Destino {
  fecha: string;
  inicio: number;
  profesionalId: string;
}

/**
 * Mover arrastrando: la cita queda en su sitio nuevo y, si choca, se pregunta si moverla igual. El aviso
 * "Cita movida" trae "Deshacer", que la devuelve a donde estaba (pasando otra vez por los choques).
 */
export function useMoverCita(localId: string, nombres: Map<string, string>) {
  const qc = useQueryClient();
  const [guardando, iniciar] = useTransicionRed();
  // Los avisos con "Deshacer" se cierran si la agenda se desmonta (el aviso vive en el layout raíz y su
  // botón ya no tendría dónde mostrar los choques).
  const avisos = useRef(new Set<string | number>());
  useEffect(() => {
    const abiertos = avisos.current;
    return () => abiertos.forEach((id) => toast.dismiss(id));
  }, []);
  const [pendiente, setPendiente] = useState<{
    datos: ReturnType<typeof datosMovida>;
    choques: ChoquesPendientes;
    antes: Copia;
    alDeshacer: (() => void) | null;
  } | null>(null);

  const terminar = useCallback(
    (
      ok: boolean,
      antes: Copia,
      error?: string,
      alDeshacer?: (() => void) | null,
    ) => {
      if (!ok) deshacer(qc, antes);
      if (error) toast.error(error, { duration: Infinity });
      else if (ok && alDeshacer)
        avisos.current.add(
          toast.success("Cita movida", {
            action: { label: "Deshacer", onClick: alDeshacer },
          }),
        );
      else if (ok) toast.success("Cita devuelta a su lugar");
      setPendiente(null);
      void qc.invalidateQueries({ queryKey: [CLAVE_AGENDA] });
    },
    [qc],
  );

  const mover = useCallback(
    function moverCita(
      cita: CitaAgenda,
      destino: Destino,
      deshaciendo = false,
    ) {
      if (
        cita.profesionalFijo &&
        destino.profesionalId !== cita.profesionalId
      ) {
        const nombre = nombres.get(cita.profesionalId) ?? "su profesional";
        toast.error(
          `Esta cita está fijada con ${nombre}. Quita el candado para cambiarla.`,
        );
        return;
      }
      const datos = datosMovida(cita, localId, destino);
      // Para deshacer se usa la cita como está AHORA (pudo cambiar de estado o de notas en vivo) y solo se le
      // cambia el lugar. Si ya no está donde se dejó, o se canceló, no se toca.
      const alDeshacer = deshaciendo
        ? null
        : () => {
            const actual = citaEnMemoria(qc, cita.id);
            if (
              !actual ||
              actual.estado === "cancelado" ||
              actual.fecha !== destino.fecha ||
              actual.inicio !== destino.inicio ||
              actual.profesionalId !== destino.profesionalId
            ) {
              toast.error(
                "La cita cambió después de moverla. Ábrela para ajustarla.",
              );
              return;
            }
            moverCita(
              actual,
              {
                fecha: cita.fecha,
                inicio: cita.inicio,
                profesionalId: cita.profesionalId,
              },
              true,
            );
          };
      iniciar(async () => {
        const antes = await cambiarEnMemoria(qc, cita.id, {
          fecha: destino.fecha,
          profesionalId: destino.profesionalId,
          inicio: destino.inicio,
          fin: destino.inicio + cita.duracionMin,
          horaInicio: aHora(destino.inicio),
          horaFin: aHora(destino.inicio + cita.duracionMin),
        });
        // Sin red, la cita vuelve a su lugar y se dice que no se guardó (T-11.4).
        const r = await guardarCita(datos).catch((e: unknown) => {
          if (!esErrorDeRed(e)) throw e;
          return null;
        });
        if (!r) return terminar(false, antes, SIN_RED_NO_GUARDO);
        if (r.ok) return terminar(true, antes, undefined, alDeshacer);
        if ("choques" in r)
          return setPendiente({
            datos,
            antes,
            alDeshacer,
            choques: {
              choques: r.choques,
              puedeForzar: r.puedeForzar,
              libres: 0,
            },
          });
        terminar(false, antes, r.error);
      });
    },
    [qc, localId, nombres, terminar, iniciar],
  );

  function forzar() {
    if (!pendiente) return;
    const { datos, antes, alDeshacer } = pendiente;
    iniciar(async () => {
      const r = await guardarCita(datos, { forzar: true }).catch(
        (e: unknown) => {
          if (!esErrorDeRed(e)) throw e;
          return null;
        },
      );
      if (!r) return terminar(false, antes, SIN_RED_NO_GUARDO);
      terminar(
        r.ok,
        antes,
        r.ok
          ? undefined
          : "choques" in r
            ? "No se pudo mover la cita"
            : r.error,
        alDeshacer,
      );
    });
  }

  const ventana = (
    <VentanaChoques
      pendientes={pendiente?.choques ?? null}
      guardando={guardando}
      onForzar={forzar}
      onVolver={() => pendiente && terminar(false, pendiente.antes)}
      textoForzar="Mover igual"
    />
  );
  return { mover, ventana };
}
