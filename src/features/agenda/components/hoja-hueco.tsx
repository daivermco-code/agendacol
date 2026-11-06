"use client";

import {
  Ban,
  CalendarPlus,
  ChevronRight,
  CircleDollarSign,
  Users,
  type LucideIcon,
} from "lucide-react";
import { usePanelVenta } from "@/features/ventas/store/panel-venta";
import { Hoja } from "@/shared/components/hoja";
import type { PedidoNuevo } from "../types";

interface Opcion {
  clave: PedidoNuevo["tipo"] | "venta";
  nombre: string;
  ayuda: string;
  Icono: LucideIcon;
  color: string;
}

const OPCIONES: Opcion[] = [
  {
    clave: "reserva",
    nombre: "Nueva reserva",
    ayuda: "Agenda una cita a esta hora.",
    Icono: CalendarPlus,
    color: "bg-ac-laguna-claro text-ac-laguna-hondo",
  },
  {
    clave: "clase",
    nombre: "Clase",
    ayuda: "Una clase con cupos para varios clientes.",
    Icono: Users,
    color: "bg-ac-info-fondo text-ac-info",
  },
  {
    clave: "bloqueo",
    nombre: "Bloquear horario",
    ayuda: "Nadie puede reservar en ese rato.",
    Icono: Ban,
    color: "bg-ac-niebla-oscura text-ac-pizarra",
  },
  {
    clave: "venta",
    nombre: "Nueva venta",
    ayuda: "Cobra servicios o productos sin cita.",
    Icono: CircleDollarSign,
    color: "bg-ac-demo-fondo text-ac-demo-texto",
  },
];

/**
 * Hoja "¿Qué quieres agregar?" al tocar un hueco de la agenda en el celular (T-12.6). En la tableta y el
 * computador sigue el menú desplegable sobre la franja.
 */
export function HojaHueco({
  cuando,
  permisos,
  onPedir,
  onCerrar,
}: {
  /** "jue 5 nov · 10:30" */
  cuando: string;
  permisos: { reserva: boolean; bloqueo: boolean; venta?: boolean };
  onPedir: (tipo: PedidoNuevo["tipo"]) => void;
  onCerrar: () => void;
}) {
  const abrirVenta = usePanelVenta((s) => s.abrir);
  const visibles = OPCIONES.filter((o) =>
    o.clave === "bloqueo"
      ? permisos.bloqueo
      : o.clave === "venta"
        ? permisos.venta
        : permisos.reserva,
  );

  return (
    <Hoja
      abierta
      onCambiar={(v) => !v && onCerrar()}
      titulo="¿Qué quieres agregar?"
      descripcion={cuando}
    >
      <p className="cifras -mt-1 mb-2 text-[13px] text-ac-pizarra">{cuando}</p>
      <ul className="-mx-2">
        {visibles.map(({ clave, nombre, ayuda, Icono, color }) => (
          <li key={clave}>
            <button
              type="button"
              className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-ac-niebla"
              onClick={() => {
                onCerrar();
                if (clave === "venta") abrirVenta({}, { tipo: "agenda" });
                else onPedir(clave);
              }}
            >
              <span
                aria-hidden="true"
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}
              >
                <Icono className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">
                  {nombre}
                </span>
                <span className="block text-[13px] text-ac-pizarra">
                  {ayuda}
                </span>
              </span>
              <ChevronRight
                className="h-5 w-5 shrink-0 text-ac-neblina"
                aria-hidden="true"
              />
            </button>
          </li>
        ))}
      </ul>
    </Hoja>
  );
}
