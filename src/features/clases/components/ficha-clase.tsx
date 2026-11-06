"use client";

import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Check, Pencil, StickyNote, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { CLAVE_AGENDA } from "@/features/agenda/hooks/use-agenda";
import {
  AvatarProfesional,
  COLOR_CLASE,
} from "@/features/agenda/components/piezas";
import type { ClaseAgenda, ProfesionalAgenda } from "@/features/agenda/types";
import { pesos, telefono } from "@/shared/lib/formato";
import { cn } from "@/shared/lib/utils";
import { cambiarInscrito, inscritosDeClase } from "../actions";
import { textoCupo } from "../lib/clases";
import type { EstadoInscrito } from "../schemas";
import type { Inscrito } from "../types";
import { InscribirCliente } from "./inscribir-cliente";

const ICONO_BOTON =
  "inline-flex h-11 w-11 md:h-8 md:w-8 items-center justify-center rounded-full text-ac-pizarra hover:bg-ac-niebla hover:text-ac-tinta";

const ESTADO: Record<EstadoInscrito, { nombre: string; clase: string }> = {
  inscrito: { nombre: "Inscrito", clase: "bg-ac-niebla text-ac-pizarra" },
  asiste: { nombre: "Asistió", clase: "bg-ac-exito-fondo text-ac-exito" },
  no_asistio: {
    nombre: "No asistió",
    clase: "bg-ac-error-fondo text-ac-error",
  },
  cancelado: {
    nombre: "Canceló",
    clase: "bg-ac-niebla-oscura text-ac-neblina",
  },
};

function FilaInscrito({
  i,
  puedeEditar,
  ocupado,
  onEstado,
}: {
  i: Inscrito;
  puedeEditar: boolean;
  ocupado: boolean;
  onEstado: (estado: EstadoInscrito) => void;
}) {
  const cancelado = i.estado === "cancelado";
  return (
    <li className="space-y-1 py-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            cancelado && "text-ac-neblina line-through",
          )}
        >
          {i.cliente}
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
            ESTADO[i.estado].clase,
          )}
        >
          {ESTADO[i.estado].nombre}
        </span>
      </div>
      {i.telefono || i.bonoNombre ? (
        <p className="cifras text-xs text-ac-pizarra">
          {[
            telefono(i.telefono),
            i.bonoNombre ? `con plan «${i.bonoNombre}»` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
      {cancelado ? null : (
        <div className="flex flex-wrap gap-1">
          {(["asiste", "no_asistio"] as const).map((e) => (
            <button
              key={e}
              type="button"
              disabled={ocupado}
              aria-pressed={i.estado === e}
              onClick={() => onEstado(i.estado === e ? "inscrito" : e)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs min-h-11 md:min-h-0",
                i.estado === e
                  ? "border-ac-laguna bg-ac-laguna-claro text-ac-laguna-hondo"
                  : "border-ac-borde text-ac-pizarra hover:bg-ac-niebla",
              )}
            >
              {i.estado === e ? (
                <Check className="h-3 w-3" aria-hidden="true" />
              ) : null}
              {ESTADO[e].nombre}
            </button>
          ))}
          {puedeEditar ? (
            <button
              type="button"
              disabled={ocupado}
              onClick={() => onEstado("cancelado")}
              className="rounded-full px-2 py-0.5 text-xs text-ac-error hover:bg-ac-niebla min-h-11 md:min-h-0"
            >
              Quitar
            </button>
          ) : null}
        </div>
      )}
    </li>
  );
}

/** Ficha de la clase: cuándo y con quién, cupo, lista de inscritos con asistencia, e inscribir. */
export function FichaClase({
  clase,
  profesional,
  puedeEditar,
  onEditar,
  onCancelar,
  onCerrar,
}: {
  clase: ClaseAgenda;
  profesional?: ProfesionalAgenda;
  puedeEditar: boolean;
  onEditar: () => void;
  onCancelar: () => void;
  onCerrar: () => void;
}) {
  const qc = useQueryClient();
  const [ocupado, iniciar] = useTransicionRed();
  const { data: inscritos, isPending } = useQuery({
    queryKey: ["inscritos", clase.id, clase.inscritos],
    queryFn: async () => {
      const r = await inscritosDeClase(clase.id);
      if (!r.ok) throw new Error(r.error);
      return r.datos;
    },
  });
  const refrescar = () => {
    void qc.invalidateQueries({ queryKey: [CLAVE_AGENDA] });
    void qc.invalidateQueries({ queryKey: ["inscritos", clase.id] });
    void qc.invalidateQueries({ queryKey: ["bonos-cliente"] });
  };
  const cambiar = (i: Inscrito, estado: EstadoInscrito) =>
    iniciar(async () => {
      const r = await cambiarInscrito({ inscritoId: i.id, estado });
      if (!r.ok) return void toast.error(r.error);
      if (estado === "cancelado")
        toast.success(`${i.cliente} salió de la clase`);
      refrescar();
    });
  const cuando = format(parseISO(clase.fecha), "EEEE d 'de' MMMM", {
    locale: es,
  });
  const lleno = Math.min((clase.inscritos / clase.cupo) * 100, 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: COLOR_CLASE.fondo, color: COLOR_CLASE.texto }}
        >
          <Users className="h-3 w-3" aria-hidden="true" /> Clase
        </span>
        <span className="flex-1" />
        {puedeEditar ? (
          <>
            <button
              type="button"
              aria-label="Cancelar la clase"
              className={ICONO_BOTON}
              onClick={onCancelar}
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Editar la clase"
              className={ICONO_BOTON}
              onClick={onEditar}
            >
              <Pencil className="h-4 w-4" />
            </button>
          </>
        ) : null}
        <button
          type="button"
          aria-label="Cerrar ficha"
          className={ICONO_BOTON}
          onClick={onCerrar}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div>
        <p className="text-[17px] font-semibold leading-tight">
          {clase.servicioNombre}
        </p>
        <p className="cifras text-sm text-ac-pizarra">
          {cuando.charAt(0).toUpperCase() + cuando.slice(1)} ·{" "}
          {clase.horaInicio} – {clase.horaFin}
        </p>
        <p className="cifras text-sm">{pesos(clase.precio)} por persona</p>
      </div>
      {profesional ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-ac-pizarra">La da</span>
          <AvatarProfesional profesional={profesional} tamano={22} />
          <span className="font-medium">{profesional.nombre}</span>
        </div>
      ) : null}
      {clase.nota ? (
        <p className="flex items-start gap-2 text-sm">
          <StickyNote className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {clase.nota}
        </p>
      ) : null}
      <div className="border-t border-ac-borde pt-3">
        <p className="cifras text-sm font-medium">
          {textoCupo(clase.inscritos, clase.cupo)}
        </p>
        <div
          className="mt-1.5 h-2 overflow-hidden rounded-full bg-ac-niebla-oscura"
          role="meter"
          aria-label="Cupo ocupado"
          aria-valuemin={0}
          aria-valuemax={clase.cupo}
          aria-valuenow={clase.inscritos}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${lleno}%`, background: COLOR_CLASE.borde }}
          />
        </div>
      </div>
      <div>
        <p className="text-sm font-medium">Lista</p>
        {isPending ? (
          <p className="text-sm text-ac-neblina">Cargando…</p>
        ) : inscritos?.length ? (
          <ul
            className="divide-y divide-ac-borde text-sm"
            aria-label="Inscritos"
          >
            {inscritos.map((i) => (
              <FilaInscrito
                key={i.id}
                i={i}
                puedeEditar={puedeEditar}
                ocupado={ocupado}
                onEstado={(e) => cambiar(i, e)}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ac-neblina">Nadie inscrito todavía.</p>
        )}
      </div>
      {puedeEditar && clase.inscritos < clase.cupo ? (
        <div className="border-t border-ac-borde pt-3">
          <p className="mb-1.5 text-sm font-medium">Inscribir cliente</p>
          <InscribirCliente clase={clase} onHecho={refrescar} />
        </div>
      ) : null}
    </div>
  );
}
