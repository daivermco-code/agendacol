import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { fechaLarga } from "../lib/fechas-publicas";
import type { CitaPublica } from "../types";
import { EstadoCliente } from "./detalle-cita-publica";

/** Citas del cliente, una por reserva, cada una con su enlace personal. */
export function ListaCitasCliente({
  citas,
}: {
  citas: CitaPublica["proximas"];
}) {
  return (
    <ul className="divide-y divide-ac-borde">
      {citas.map((c) => (
        <li key={c.token}>
          <Link
            href={`/cita/${c.token}`}
            className="flex items-center gap-3 rounded-md py-2.5 hover:bg-ac-niebla"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{c.servicio}</p>
              <p className="text-sm text-ac-pizarra">
                {fechaLarga(c.fecha)} · {c.inicio} · {c.profesional}
              </p>
              <EstadoCliente estado={c.estado} />
            </div>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-ac-neblina"
              aria-hidden="true"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
