"use client";

import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Ticket } from "lucide-react";
import { toast } from "sonner";
import { CLAVE_AGENDA } from "@/features/agenda/hooks/use-agenda";
import type { CitaAgenda } from "@/features/agenda/types";
import { Button } from "@/shared/ui/button";
import { bonosDeCliente, soltarBono, usarBono } from "../actions";
import type { Bono } from "../types";

const CLAVE_BONOS = "bonos-cliente";

/** Los planes del cliente que pueden cubrir esta cita (la base lo vuelve a revisar al usarlo). */
function sirven(bonos: Bono[], cita: CitaAgenda) {
  return bonos.filter(
    (b) =>
      b.estado === "activo" &&
      b.inicio <= cita.fecha &&
      b.vence >= cita.fecha &&
      (b.servicios.length === 0 || b.servicios.includes(cita.servicioId)),
  );
}

const quedan = (b: Bono) =>
  b.cupo === null ? "sin límite" : `quedan ${b.cupo - b.usadas}`;

/** En la ficha de la cita: «Con plan X · Quitar», o los planes del cliente que la pueden cubrir ($0). */
export function PlanCita({ cita }: { cita: CitaAgenda }) {
  const qc = useQueryClient();
  const [ocupado, iniciar] = useTransicionRed();
  const buscar = !cita.bonoId && !cita.ventaId && Boolean(cita.clienteId);
  const { data } = useQuery({
    queryKey: [CLAVE_BONOS, cita.clienteId],
    queryFn: async () => {
      const r = await bonosDeCliente(cita.clienteId);
      return r.ok ? r.datos : [];
    },
    enabled: buscar,
  });

  function hacer(accion: () => ReturnType<typeof soltarBono>, hecho: string) {
    iniciar(async () => {
      const r = await accion();
      if (!r.ok) return void toast.error(r.error);
      toast.success(hecho);
      void qc.invalidateQueries({ queryKey: [CLAVE_AGENDA] });
      void qc.invalidateQueries({ queryKey: [CLAVE_BONOS] });
    });
  }

  if (cita.bonoId) {
    return (
      <div className="flex flex-wrap items-center gap-2 border-t border-ac-borde pt-3 text-sm">
        <Ticket className="h-4 w-4 text-ac-laguna" aria-hidden="true" />
        <span className="flex-1">
          Con plan <span className="font-medium">«{cita.bonoNombre}»</span>
        </span>
        {cita.ventaId ? null : (
          <Button
            size="sm"
            variant="ghost"
            disabled={ocupado}
            onClick={() =>
              hacer(() => soltarBono(cita.id), "La cita salió del plan")
            }
          >
            Quitar
          </Button>
        )}
      </div>
    );
  }
  const opciones = buscar && data ? sirven(data, cita) : [];
  if (!opciones.length) return null;
  return (
    <div className="space-y-2 border-t border-ac-borde pt-3 text-sm">
      <p className="font-medium">El cliente tiene un plan</p>
      {opciones.map((b) => (
        <Button
          key={b.id}
          size="sm"
          variant="outline"
          className="w-full justify-start whitespace-normal py-1.5 text-left md:h-auto"
          disabled={ocupado}
          onClick={() =>
            hacer(
              () => usarBono({ citaId: cita.id, bonoId: b.id }),
              `La cita va con «${b.nombre}»`,
            )
          }
        >
          {ocupado ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Ticket className="h-4 w-4" aria-hidden="true" />
          )}
          Usar «{b.nombre}» ({quedan(b)})
        </Button>
      ))}
    </div>
  );
}
