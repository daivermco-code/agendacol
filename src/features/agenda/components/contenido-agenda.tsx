"use client";

import type { ComponentProps } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Armchair, RotateCw, WifiOff } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import type { useVistaAgenda } from "../hooks/use-vista-agenda";
import { useAgendaStore } from "../store/agenda";
import type { CitaAgenda, PedidoNuevo } from "../types";
import { Cuadricula } from "./cuadricula";
import { AvatarProfesional } from "./piezas";
import { moverAncla } from "../lib/fechas";
import { VistaLista } from "./vista-lista";
import { VistaListaCelular } from "./vista-lista-celular";
import { VistaMes } from "./vista-mes";

function CabeceraDia({ fecha, hoy }: { fecha: string; hoy: string }) {
  const d = parseISO(fecha);
  const largo = format(d, "EEEE dd/MM", { locale: es });
  const corto = format(d, "EEE dd/MM", { locale: es }).replace(".", "");
  const mayus = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  return (
    <div
      className={cn(
        "cifras truncate px-1 py-3 text-center text-[14px] font-medium",
        fecha === hoy && "font-bold text-ac-laguna",
      )}
    >
      <span className="md:hidden xl:inline">{mayus(largo)}</span>
      <span className="hidden md:inline xl:hidden">{mayus(corto)}</span>
      {fecha === hoy ? (
        <span className="mx-auto mt-1 block h-[3px] w-8 rounded-full bg-ac-laguna" />
      ) : null}
    </div>
  );
}

/** La vista elegida (semana, día, mes o lista) con sus estados de carga y error. */
export function Contenido({
  v,
  esCelular,
  permisos,
  onNuevo,
  onCita,
  onBloqueo,
  onMover,
  onEmpiezaArrastre,
  onEditar,
  onEliminar,
}: {
  v: ReturnType<typeof useVistaAgenda>;
  esCelular: boolean;
  permisos: { reserva: boolean; bloqueo: boolean; venta: boolean };
  onNuevo: (p: PedidoNuevo) => void;
  onCita: (c: CitaAgenda, el: HTMLElement) => void;
  onBloqueo?: (bloqueoId: string) => void;
  onMover?: ComponentProps<typeof Cuadricula>["onMover"];
  onEmpiezaArrastre?: () => void;
  onEditar: (c: CitaAgenda) => void;
  onEliminar: (c: CitaAgenda) => void;
}) {
  const poner = useAgendaStore((s) => s.poner);
  const { prefs, consulta } = v;
  // Sin red, una semana que no se alcanzó a cargar espera en pausa (con la anterior de relleno): se dice (T-11.6).
  if (
    v.listo &&
    consulta.fetchStatus === "paused" &&
    (!consulta.data || consulta.isPlaceholderData)
  ) {
    const que =
      prefs.vista === "dia"
        ? "este día no está cargado"
        : prefs.vista === "mes"
          ? "este mes no está cargado"
          : "esta semana no está cargada";
    return (
      <div
        className="m-3 flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-ac-borde bg-ac-papel p-8 text-center"
        role="status"
      >
        <WifiOff className="h-6 w-6 text-ac-aviso" aria-hidden="true" />
        <p className="font-semibold">Sin conexión: {que}</p>
        <p className="text-sm text-ac-pizarra">
          Vuelve a las fechas que ya viste o espera a que vuelva la red.
        </p>
      </div>
    );
  }
  if (!v.listo || (consulta.isPending && !consulta.data)) {
    return (
      <div
        className="m-3 flex-1 animate-pulse rounded-lg bg-ac-papel"
        aria-label="Cargando la agenda"
      />
    );
  }
  if (consulta.isError && !consulta.data) {
    return (
      <div
        className="m-3 flex flex-col items-center gap-3 rounded-lg border border-ac-borde bg-ac-papel p-8 text-center"
        role="alert"
      >
        <p className="font-semibold">No pudimos cargar la agenda.</p>
        <Button variant="outline" onClick={() => void consulta.refetch()}>
          <RotateCw className="h-4 w-4" aria-hidden="true" /> Reintentar
        </Button>
      </div>
    );
  }
  if (prefs.vista === "mes") {
    return (
      <VistaMes
        dias={v.rango.dias}
        ancla={v.ancla}
        hoy={v.ahora.fecha}
        citas={v.citas}
        onDia={(f) => {
          v.setAncla(f);
          poner({ vista: "dia" });
        }}
      />
    );
  }
  if (prefs.vista === "lista" && esCelular && v.local) {
    return (
      <VistaListaCelular
        dias={v.rango.dias}
        hoy={v.ahora.fecha}
        citas={v.citas}
        clases={v.clases}
        profesionales={v.activos}
        profesional={v.profesional}
        esPropio={Boolean(v.fijo)}
        horarioLocal={v.local.horario}
        onCita={onCita}
        onAnteriores={() => v.setAncla(moverAncla("lista", v.ancla, -1))}
      />
    );
  }
  if (prefs.vista === "lista") {
    return (
      <VistaLista
        dias={v.rango.dias}
        citas={v.citas}
        clases={v.clases}
        profesionales={v.activos}
        agrupada={prefs.agrupada}
        puedeAgendar={permisos.reserva}
        onAgrupada={(agrupada) => poner({ agrupada })}
        onNueva={() => onNuevo({ tipo: "reserva" })}
        onCita={onCita}
        onEditar={onEditar}
        onEliminar={onEliminar}
      />
    );
  }
  const esDia = prefs.vista === "dia";
  const colores =
    (esDia && !v.porRecursos) || v.profesional
      ? null
      : new Map(
          v.activos.map((p) => [p.id, { color: p.color, nombre: p.nombre }]),
        );
  return (
    <Cuadricula
      columnas={v.columnas}
      cabecera={(c) =>
        c.recurso ? (
          <div className="flex items-center justify-center gap-2 px-2 py-2.5">
            <Armchair
              className="h-5 w-5 shrink-0 text-ac-pizarra"
              aria-hidden="true"
            />
            <span className="truncate font-medium">{c.recurso.nombre}</span>
          </div>
        ) : esDia && c.profesional ? (
          <div className="flex items-center justify-center gap-2 px-2 py-2.5">
            <AvatarProfesional profesional={c.profesional} tamano={28} />
            <span className="truncate font-medium">{c.profesional.nombre}</span>
          </div>
        ) : (
          <CabeceraDia fecha={c.fecha} hoy={v.ahora.fecha} />
        )
      }
      escala={v.escala}
      ahora={v.ahora}
      anchoMinimo={
        esDia ? (prefs.ajustarColumnas ? 0 : 150) : esCelular ? 0 : 96
      }
      columnasVisibles={
        !esDia && esCelular ? (prefs.vista === "3dias" ? 3 : 2) : undefined
      }
      colores={colores}
      topeCarriles={esCelular ? (esDia ? 3 : 2) : undefined}
      filtro={v.filtro}
      permisos={permisos}
      cargando={consulta.isFetching && consulta.isPlaceholderData}
      onNuevo={onNuevo}
      onCita={onCita}
      onBloqueo={onBloqueo}
      onMover={v.porRecursos ? undefined : onMover}
      onEmpiezaArrastre={onEmpiezaArrastre}
    />
  );
}
