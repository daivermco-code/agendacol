"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { useQuery } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { ClaseAgenda } from "@/features/agenda/types";
import { BuscadorClientes } from "@/features/clientes/components/buscador-clientes";
import type { ClienteResumen } from "@/features/clientes/schemas";
import { bonosDeCliente } from "@/features/planes/actions";
import { Button } from "@/shared/ui/button";
import { CONTROL } from "@/features/citas/components/campos-reserva";
import { inscribirCliente } from "../actions";

/** Buscar al cliente, elegir si paga con uno de sus planes y anotarlo en la clase. */
export function InscribirCliente({
  clase,
  onHecho,
}: {
  clase: ClaseAgenda;
  onHecho: () => void;
}) {
  const [cliente, setCliente] = useState<ClienteResumen | null>(null);
  const [bonoId, setBonoId] = useState("");
  const [ocupado, iniciar] = useTransicionRed();
  const { data: planes, isFetching } = useQuery({
    queryKey: ["bonos-cliente", cliente?.id],
    queryFn: async () => {
      const r = await bonosDeCliente(cliente?.id);
      return r.ok ? r.datos : [];
    },
    enabled: Boolean(cliente),
  });
  const sirven = (planes ?? []).filter(
    (b) =>
      b.estado === "activo" &&
      b.inicio <= clase.fecha &&
      b.vence >= clase.fecha &&
      (b.servicios.length === 0 || b.servicios.includes(clase.servicioId)),
  );

  function inscribir() {
    if (!cliente) return;
    iniciar(async () => {
      const r = await inscribirCliente({
        claseId: clase.id,
        clienteId: cliente.id,
        bonoId: bonoId || null,
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${cliente.nombre} ya está en la clase`);
      setCliente(null);
      setBonoId("");
      onHecho();
    });
  }

  if (!cliente)
    return (
      <BuscadorClientes
        id={`inscribir-${clase.id}`}
        onElegir={(c) => setCliente(c)}
        onNuevo={() =>
          toast.info("Crea el cliente desde Clientes y vuelve a buscarlo.")
        }
      />
    );
  return (
    <div className="space-y-2 rounded-md border border-ac-borde p-2.5 text-sm">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-medium">
          {cliente.nombre} {cliente.apellido}
        </span>
        <button
          type="button"
          aria-label="Elegir otro cliente"
          className="rounded p-3.5 text-ac-pizarra hover:bg-ac-niebla md:p-1"
          onClick={() => setCliente(null)}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {sirven.length ? (
        <label className="block">
          <span className="mb-1 block text-xs text-ac-pizarra">Cómo paga</span>
          <select
            className={CONTROL}
            value={bonoId}
            onChange={(e) => setBonoId(e.target.value)}
          >
            <option value="">Sin plan (paga la clase)</option>
            {sirven.map((b) => (
              <option key={b.id} value={b.id}>
                Con «{b.nombre}» (
                {b.cupo === null ? "sin límite" : `quedan ${b.cupo - b.usadas}`}
                )
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <Button
        size="sm"
        className="w-full"
        disabled={ocupado || isFetching}
        onClick={inscribir}
      >
        {ocupado ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : null}
        Inscribir
      </Button>
    </div>
  );
}
