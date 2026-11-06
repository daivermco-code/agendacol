import { CalendarDays, Clock, MapPin } from "lucide-react";
import { duracion, pesos } from "@/shared/lib/formato";
import { cn, iniciales } from "@/shared/lib/utils";
import { fechaLarga } from "../lib/fechas-publicas";
import type { CitaPublica, EstadoCitaPublica } from "../types";

/** Cómo ve el cliente cada estado (palabras suyas, no las de la agenda). */
const ESTADO_CLIENTE: Record<
  EstadoCitaPublica,
  { nombre: string; clase: string }
> = {
  reservado: {
    nombre: "Por confirmar",
    clase: "bg-ac-info-fondo text-ac-info",
  },
  confirmado: {
    nombre: "Confirmada",
    clase: "bg-ac-exito-fondo text-ac-exito",
  },
  asiste: {
    nombre: "Atendida",
    clase: "bg-ac-laguna-claro text-ac-laguna-hondo",
  },
  no_asistio: {
    nombre: "No asististe",
    clase: "bg-ac-niebla-oscura text-ac-pizarra",
  },
  pendiente: { nombre: "Pendiente", clase: "bg-ac-aviso-fondo text-ac-aviso" },
  en_espera: { nombre: "En espera", clase: "bg-ac-aviso-fondo text-ac-aviso" },
  cancelado: { nombre: "Cancelada", clase: "bg-ac-error-fondo text-ac-error" },
};

export function EstadoCliente({ estado }: { estado: EstadoCitaPublica }) {
  const e = ESTADO_CLIENTE[estado];
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
        e.clase,
      )}
    >
      {e.nombre}
    </span>
  );
}

/** Tarjeta de la cita: estado, día, horas, servicios, profesional y lugar. */
export function DetalleCitaPublica({ cita }: { cita: CitaPublica }) {
  const total = cita.servicios.reduce((s, x) => s + (x.precio ?? 0), 0);
  const conPrecio = cita.servicios.every((x) => x.precio !== null);
  const cancelada = cita.estado === "cancelado";
  return (
    <section
      aria-label="Tu cita"
      className="rounded-lg border border-ac-borde bg-ac-papel p-4 shadow-quieta sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1
          className={cn(
            "text-xl font-bold",
            cancelada && "text-ac-pizarra line-through decoration-1",
          )}
        >
          {fechaLarga(cita.fecha)}
        </h1>
        <EstadoCliente estado={cita.estado} />
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-ac-pizarra">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-4 w-4" aria-hidden="true" />
          {cita.inicio} a {cita.fin}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          {duracion(cita.duracion)}
        </span>
      </p>
      {cancelada && cita.avisoCancelacion ? (
        <p className="mt-3 rounded-md bg-ac-error-fondo px-3 py-2 text-sm text-ac-error">
          {cita.avisoCancelacion}
        </p>
      ) : null}

      <ul className="mt-4 divide-y divide-ac-borde border-y border-ac-borde">
        {cita.servicios.map((s, i) => (
          <li
            key={`${s.inicio}-${i}`}
            className="flex justify-between gap-3 py-2.5"
          >
            <div>
              <p className="font-medium">{s.nombre}</p>
              <p className="text-xs text-ac-neblina">
                {s.inicio} a {s.fin}
              </p>
            </div>
            {s.precio !== null ? (
              <span className="tabular-nums">{pesos(s.precio)}</span>
            ) : null}
          </li>
        ))}
      </ul>
      {cita.servicios.length > 1 && conPrecio ? (
        <p className="flex justify-between py-2.5 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{pesos(total)}</span>
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{
              backgroundColor: cita.profesional.color ?? "#64748B",
            }}
          >
            {iniciales(cita.profesional.nombre)}
          </span>
          <div className="min-w-0">
            <p className="text-xs text-ac-neblina">Te atiende</p>
            <p className="truncate font-medium">{cita.profesional.nombre}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ac-niebla text-ac-pizarra">
            <MapPin className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-medium">
              {cita.negocio.nombre} · {cita.local.nombre}
            </p>
            {cita.local.direccion ? (
              <p className="text-sm text-ac-pizarra">{cita.local.direccion}</p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
