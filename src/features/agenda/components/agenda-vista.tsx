"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { pasoDeslizar } from "../lib/deslizar";
import { usePuede } from "@/features/auth/components/proveedor-miembro";
import { useEsCelular } from "@/shared/hooks/use-es-celular";
import { Hoja } from "@/shared/components/hoja";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import {
  moverAncla,
  tituloCorto,
  tituloRango,
  type Vista,
} from "../lib/fechas";
import { TODOS, useAgendaStore } from "../store/agenda";
import { useCapaCitas } from "@/features/citas/components/capa-citas";
import type { BaseAgenda, PedidoNuevo } from "../types";
import { useVistaAgenda } from "../hooks/use-vista-agenda";
import { BarraAgenda } from "./barra-agenda";
import { BusquedaHora } from "./busqueda-hora";
import { CapaClases } from "@/features/clases/components/capa-clases";
import { MenuNuevo } from "./controles-agenda";
import { CabeceraCelular } from "./cabecera-celular";
import { Contenido } from "./contenido-agenda";
import { FichasFiltro } from "./fichas-filtro";
import { PanelFiltros } from "./panel-filtros";
import { InterruptorAhora, VistaAhora } from "./vista-ahora";

/** Pantalla de agenda: panel de filtros, barra, fichas y la vista elegida. */
export function AgendaVista({
  base,
  vistaInicial,
  fechaInicial,
  clienteInicial,
}: {
  base: BaseAgenda;
  vistaInicial: Vista | null;
  fechaInicial: string | null;
  clienteInicial?: PedidoNuevo["cliente"] | null;
}) {
  const esCelular = useEsCelular();
  const [busqueda, setBusqueda] = useState("");
  // La caja de búsqueda solo está en el celular: desde 768 px no filtra, aunque haya quedado texto.
  const v = useVistaAgenda(
    base,
    vistaInicial,
    fechaInicial,
    esCelular ? busqueda : "",
  );
  const poner = useAgendaStore((s) => s.poner);
  const puedo = usePuede();
  const raiz = useRef<HTMLDivElement>(null);
  const [cajon, setCajon] = useState(false);
  const [hace, setHace] = useState(0);
  const toque = useRef<{
    x: number;
    y: number;
    t: number;
    alInicio: boolean;
    alFinal: boolean;
  } | null>(null);
  const { prefs, consulta } = v;
  // Vista "Ahora" (T-12.8): solo en el celular, en la vista Día, para el Dueño con 2 o más profesionales.
  const [modo, setModo] = useState<"dia" | "ahora">("dia");
  const puedeAhora =
    esCelular &&
    v.listo &&
    puedo("administrar") &&
    v.activos.length >= 2 &&
    prefs.vista === "dia" &&
    !v.porRecursos;
  const verAhora = puedeAhora && modo === "ahora";
  // A medianoche "Ahora" pasa solo al día nuevo.
  const [fechaReloj, setFechaReloj] = useState(v.ahora.fecha);
  const cambioDia = fechaReloj !== v.ahora.fecha;
  if (cambioDia) {
    setFechaReloj(v.ahora.fecha);
    if (verAhora) v.setAncla(v.ahora.fecha);
  }
  // "Ahora" es siempre hoy: si la fecha cambia (flechas o calendario), se vuelve a la vista Día. También si deja
  // de poder verse (otra vista, la tableta o menos profesionales).
  if (
    modo === "ahora" &&
    v.listo &&
    (!puedeAhora || (!cambioDia && v.ancla !== v.ahora.fecha))
  )
    setModo("dia");
  const permisos = {
    reserva: puedo("crear_cita"),
    bloqueo: puedo("bloquear_horario"),
    venta: puedo("cobrar"),
  };

  useEffect(() => {
    const calcular = () =>
      setHace(
        consulta.dataUpdatedAt
          ? Math.floor((Date.now() - consulta.dataUpdatedAt) / 60_000)
          : 0,
      );
    calcular();
    const id = window.setInterval(calcular, 30_000);
    return () => window.clearInterval(id);
  }, [consulta.dataUpdatedAt]);

  useEffect(() => {
    if (v.listo) {
      const url = new URL(window.location.href);
      url.searchParams.set("vista", prefs.vista);
      url.searchParams.delete("fecha"); // ?fecha= solo abre ese día una vez
      window.history.replaceState(null, "", url);
    }
  }, [v.listo, prefs.vista]);

  const capa = useCapaCitas({
    base,
    local: v.local,
    hoy: v.ahora,
    fechaVista: v.rango.dias.includes(v.ahora.fecha) ? v.ahora.fecha : v.ancla,
    profesionalVista: v.profesional,
    activos: v.activos,
    datos: consulta.data,
    esCelular,
  });
  const onNuevo = capa.nuevo;
  const reservarPendiente = useRef(clienteInicial ?? null);

  // "Nueva reserva" desde la ficha del cliente: abre la ventana una sola vez, con el cliente puesto.
  useEffect(() => {
    const cliente = reservarPendiente.current;
    if (!v.listo || !v.local || !cliente) return;
    reservarPendiente.current = null;
    onNuevo({ tipo: "reserva", cliente });
    const url = new URL(window.location.href);
    url.searchParams.delete("reservar");
    window.history.replaceState(null, "", url);
  }, [v.listo, v.local, onNuevo]);

  const elegirFecha = (f: string) => {
    v.setAncla(f);
    setCajon(false);
  };
  const abrirPanel = () => {
    if (window.matchMedia("(min-width: 1024px)").matches)
      poner({ plegado: false });
    else setCajon(true);
  };
  // Deslizar de lado en el celular cambia de día o de rango (T-12.5), solo si la cuadrícula ya está en su borde.
  // Los toques dentro de una hoja (portal) también llegan aquí por React: se ignoran si no son de la agenda.
  const alTocar = (e: React.TouchEvent) => {
    if (!esCelular || verAhora || e.touches.length !== 1) return;
    if (!e.currentTarget.contains(e.target as Node)) return;
    const t = e.touches[0];
    const caja = (e.target as Element).closest<HTMLElement>('[role="grid"]');
    const izquierda = caja?.scrollLeft ?? 0;
    toque.current = {
      x: t.clientX,
      y: t.clientY,
      t: e.timeStamp,
      alInicio: izquierda <= 1,
      alFinal: !caja || izquierda + caja.clientWidth >= caja.scrollWidth - 1,
    };
  };
  const alSoltarToque = (e: React.TouchEvent) => {
    const inicio = toque.current;
    toque.current = null;
    if (!inicio || e.changedTouches.length !== 1) return;
    const t = e.changedTouches[0];
    const paso = pasoDeslizar({
      dx: t.clientX - inicio.x,
      dy: t.clientY - inicio.y,
      ms: e.timeStamp - inicio.t,
      alInicio: inicio.alInicio,
      alFinal: inicio.alFinal,
    });
    if (paso) v.setAncla(moverAncla(prefs.vista, v.ancla, paso));
  };
  const lejosDeHoy = v.listo && !v.rango.dias.includes(v.ahora.fecha);

  const pantallaCompleta = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void raiz.current?.requestFullscreen();
  };

  if (!v.local) {
    return (
      <p className="p-6 text-ac-pizarra">
        Crea un local en Administración para ver la agenda.
      </p>
    );
  }

  const controles = {
    vista: prefs.vista,
    onVista: (vista: Vista) => poner({ vista }),
    onMover: (paso: 1 | -1) =>
      v.setAncla(moverAncla(prefs.vista, v.ancla, paso)),
    onHoy: () => v.setAncla(v.ahora.fecha),
    titulo: tituloRango(prefs.vista, v.ancla),
    subtitulo:
      v.profesional?.nombre ?? `${v.local.nombre} · Todos los profesionales`,
    hace,
    enVivo: v.enVivo,
    recargando: consulta.isFetching,
    onRecargar: () => void consulta.refetch(),
    bloque: v.bloque,
    onBloque: (b: number) => poner({ bloqueMin: b }),
    permisos,
    onNuevo,
  };
  const panel = (onPlegar?: () => void) => (
    <PanelFiltros
      locales={base.locales}
      local={v.local}
      hayRecursos={v.recursos.length > 0}
      profesionales={v.activos}
      profesional={v.profesional}
      profesionalFijo={v.fijo}
      ancla={v.ancla}
      hoy={v.ahora.fecha}
      desde={v.rango.desde}
      hasta={v.rango.hasta}
      onAncla={elegirFecha}
      onPlegar={onPlegar}
      busqueda={
        permisos.reserva ? (
          <BusquedaHora
            localId={v.local?.id ?? ""}
            servicios={base.servicios}
            profesionales={v.activos}
            hoy={v.ahora.fecha}
            onElegir={(pedido) => {
              if (pedido.fecha) v.setAncla(pedido.fecha);
              setCajon(false);
              onNuevo(pedido);
            }}
          />
        ) : null
      }
    />
  );

  return (
    <div
      ref={raiz}
      data-agenda
      className="flex min-h-0 flex-1 bg-ac-niebla print:block"
    >
      {prefs.plegado ? null : (
        <aside className="hidden w-[280px] shrink-0 overflow-y-auto border-r border-ac-borde bg-ac-papel lg:block print:hidden">
          {panel(() => poner({ plegado: true }))}
        </aside>
      )}
      {esCelular ? (
        <Hoja
          abierta={cajon}
          onCambiar={setCajon}
          titulo="Filtros de la agenda"
          cuerpo="p-0"
          pie={
            <Button
              className="h-12 w-full rounded-full text-[15px]"
              onClick={() => setCajon(false)}
            >
              Listo
            </Button>
          }
        >
          {panel()}
        </Hoja>
      ) : (
        <Sheet open={cajon} onOpenChange={setCajon}>
          <SheetContent
            side="left"
            className="w-[340px] overflow-y-auto p-0 sm:max-w-[300px] md:w-[300px]"
          >
            <SheetTitle className="sr-only">Filtros de la agenda</SheetTitle>
            {panel()}
          </SheetContent>
        </Sheet>
      )}
      <main className="flex min-w-0 flex-1 flex-col">
        <h1 className="sr-only">Agenda</h1>
        <div className="hidden md:block">
          <BarraAgenda
            {...controles}
            plegado={prefs.plegado}
            onAbrirPanel={abrirPanel}
            ajustar={prefs.vista === "dia" ? prefs.ajustarColumnas : null}
            onAjustar={() => poner({ ajustarColumnas: !prefs.ajustarColumnas })}
            onPantallaCompleta={pantallaCompleta}
          />
        </div>
        <div className="md:hidden">
          <CabeceraCelular
            {...controles}
            tituloCorto={tituloCorto(prefs.vista, v.ancla)}
            busqueda={busqueda}
            onBusqueda={setBusqueda}
            sinBusqueda={verAhora}
            encontradas={v.citas.length}
            onAbrirPanel={() => setCajon(true)}
          />
          {puedeAhora ? (
            <InterruptorAhora
              modo={modo}
              onModo={(m) => {
                if (m === "ahora") {
                  v.setAncla(v.ahora.fecha);
                  setBusqueda("");
                }
                setModo(m);
              }}
            />
          ) : null}
        </div>
        {verAhora ? null : (
          <FichasFiltro
            profesional={v.profesional}
            fijo={Boolean(v.fijo)}
            estados={prefs.estados}
            onQuitarProfesional={() => poner({ profesionalId: TODOS })}
            onQuitarEstados={() =>
              poner({ estados: useAgendaStore.getInitialState().estados })
            }
          />
        )}
        <div
          className="contents"
          onTouchStart={alTocar}
          onTouchEnd={alSoltarToque}
          onTouchCancel={() => (toque.current = null)}
        >
          {verAhora && v.local ? (
            <VistaAhora
              localId={v.local.id}
              profesionales={v.activos}
              ahora={v.ahora}
              puedeReservar={permisos.reserva}
              onNuevo={onNuevo}
            />
          ) : (
            <Contenido
              v={v}
              esCelular={esCelular}
              permisos={permisos}
              onNuevo={onNuevo}
              onCita={capa.abrirCita}
              onBloqueo={capa.abrirBloqueo}
              onMover={capa.mover}
              onEmpiezaArrastre={() => {
                toque.current = null;
              }}
              onEditar={capa.editar}
              onEliminar={capa.eliminar}
            />
          )}
        </div>
      </main>
      {capa.ventanas}
      <CapaClases
        base={base}
        local={v.local}
        datos={consulta.data}
        esCelular={esCelular}
      />
      {lejosDeHoy ? (
        <button
          type="button"
          onClick={controles.onHoy}
          className="fixed bottom-[var(--alto-pestanas)] right-[88px] z-30 inline-flex h-14 items-center justify-center rounded-full border border-ac-borde bg-ac-papel px-6 text-[15px] font-semibold text-ac-laguna-hondo shadow-flota hover:bg-ac-niebla md:hidden print:hidden"
        >
          Hoy
        </button>
      ) : null}
      <MenuNuevo permisos={permisos} onNuevo={onNuevo}>
        <button
          type="button"
          aria-label="Nuevo"
          data-guia="cita"
          className="fixed bottom-[var(--alto-pestanas)] right-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-ac-laguna text-ac-papel shadow-flota hover:bg-ac-laguna-hondo md:hidden print:hidden"
        >
          <Plus className="h-6 w-6" />
        </button>
      </MenuNuevo>
    </div>
  );
}
