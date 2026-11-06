"use client";

import { useQuery } from "@tanstack/react-query";
import { Estrellas } from "@/shared/components/estrellas";
import { crearClienteNavegador } from "@/shared/lib/supabase/client";

/** La calificación de la reserva (una sola, aunque tenga varios servicios). RLS: dueño, recepción o el profesional. */
async function cargarCalificacion(citaId: string) {
  const supabase = crearClienteNavegador();
  const { data: cita } = await supabase
    .from("citas")
    .select("reserva_id")
    .eq("id", citaId)
    .maybeSingle();
  const consulta = supabase
    .from("calificaciones")
    .select("estrellas, comentario, citas!inner(reserva_id)")
    .limit(1);
  const { data, error } = cita?.reserva_id
    ? await consulta.eq("citas.reserva_id", cita.reserva_id)
    : await consulta.eq("cita_id", citaId);
  if (error) throw new Error(error.message);
  return data[0] ?? null;
}

/** En la ficha de una cita atendida: cómo calificó el cliente la atención (privado). */
export function CalificacionCita({ citaId }: { citaId: string }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ["calificacion", citaId],
    queryFn: () => cargarCalificacion(citaId),
  });

  return (
    <div className="space-y-1 border-t border-ac-borde pt-3 text-sm">
      <p className="font-medium">Calificación del cliente</p>
      {isPending ? (
        <p className="text-ac-neblina">Cargando…</p>
      ) : isError ? (
        <p className="text-ac-neblina">No se pudo cargar.</p>
      ) : data ? (
        <>
          <Estrellas valor={data.estrellas} />
          {data.comentario ? (
            <p className="text-ac-pizarra">“{data.comentario}”</p>
          ) : null}
        </>
      ) : (
        <p className="text-ac-neblina">
          Todavía no califica. Puede hacerlo desde su enlace hasta 30 días
          después.
        </p>
      )}
    </div>
  );
}
