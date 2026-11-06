"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Hoja } from "@/shared/components/hoja";
import { cargarFichaCliente } from "../actions";
import type { DatosCliente } from "../schemas";
import { FichaClienteCelular } from "./ficha-cliente-celular";

type Clave = keyof Omit<DatosCliente, "id">;

/** La ficha del cliente en una hoja desde abajo (lista de Clientes del celular). */
export function HojaCliente({
  id,
  onCerrar,
  volverA,
  version,
}: {
  id: string;
  /** Cambia con cada recarga de la página (cobrar o entregar un premio desde la hoja): la ficha se vuelve a leer. */
  version?: unknown;
  onCerrar: () => void;
  /** Adónde va el foco al cerrar (`borrado`: su fila ya no está); `null`, a lo que la abrió. */
  volverA?: (borrado: boolean) => HTMLElement | null;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [editando, setEditando] = useState<Clave | null>(null);
  const borrado = useRef(false);
  const consulta = useQuery({
    queryKey: ["ficha-cliente", id],
    queryFn: () => cargarFichaCliente(id),
    staleTime: 0,
  });
  const primera = useRef(version);
  useEffect(() => {
    if (version === primera.current) return;
    primera.current = version;
    void qc.invalidateQueries({ queryKey: ["ficha-cliente", id] });
  }, [version, id, qc]);
  const datos = consulta.data?.ok ? consulta.data : null;
  const titulo = datos
    ? `${datos.ficha.cliente.nombre} ${datos.ficha.cliente.apellido}`
    : "Ficha del cliente";

  return (
    <Hoja
      abierta
      onCambiar={(v) => !v && onCerrar()}
      titulo={titulo}
      descripcion="Ficha del cliente"
      tituloOculto
      className="h-[92dvh]"
      volverA={() => volverA?.(borrado.current) ?? null}
      // Con un dato abierto, Escape cancela la edición y la hoja sigue abierta.
      alEscape={(e) => {
        if (!editando) return;
        e.preventDefault();
        // Mientras se guarda, el dato sigue abierto: si falla, el error se ve en su fila.
        if (!document.querySelector("form[data-guardando]")) setEditando(null);
      }}
    >
      {consulta.isPending ? (
        <div role="status" className="flex justify-center py-16">
          <Loader2
            className="h-6 w-6 animate-spin text-ac-pizarra"
            aria-hidden="true"
          />
          <span className="sr-only">Cargando la ficha</span>
        </div>
      ) : !datos ? (
        <p role="alert" className="py-10 text-center text-ac-error">
          {consulta.data && !consulta.data.ok
            ? consulta.data.error
            : "No pudimos abrir la ficha. Intenta de nuevo."}
        </p>
      ) : (
        <FichaClienteCelular
          ficha={datos.ficha}
          hoy={datos.hoy}
          sellos={datos.sellos}
          editando={editando}
          onEditando={setEditando}
          onCambio={async () => {
            await qc.invalidateQueries({ queryKey: ["ficha-cliente", id] });
            router.refresh();
          }}
          onBorrado={() => {
            borrado.current = true;
            onCerrar();
            router.refresh();
          }}
        />
      )}
    </Hoja>
  );
}
