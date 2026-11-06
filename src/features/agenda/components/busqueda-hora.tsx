"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Search } from "lucide-react";
import { buscarHorasLibres, type HoraLibre } from "@/features/citas/actions";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { aMinutos } from "../lib/fechas";
import type { PedidoNuevo, ProfesionalAgenda, ServicioAgenda } from "../types";

const CUALQUIERA = "";
const SELECTOR =
  "h-11 w-full md:h-10 rounded-md border border-ac-borde bg-ac-papel px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-foco";

function cuando(h: HoraLibre, hoy: string) {
  const dia =
    h.fecha === hoy
      ? "Hoy"
      : format(parseISO(h.fecha), "EEE d MMM", { locale: es });
  return `${dia} · ${h.hora.slice(0, 5)}`;
}

/**
 * Búsqueda rápida de hora: elige servicio y profesional (o cualquiera) y muestra las primeras horas libres desde
 * hoy; al tocar una, abre la nueva reserva con todo puesto.
 */
export function BusquedaHora({
  localId,
  servicios,
  profesionales,
  hoy,
  onElegir,
}: {
  localId: string;
  servicios: ServicioAgenda[];
  profesionales: ProfesionalAgenda[];
  hoy: string;
  onElegir: (pedido: PedidoNuevo) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [servicioId, setServicioId] = useState("");
  const [profesionalId, setProfesionalId] = useState(CUALQUIERA);
  const [horas, setHoras] = useState<HoraLibre[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [buscando, iniciar] = useTransicionRed();
  const servicio = servicios.find((s) => s.id === servicioId);
  const quienes = profesionales.filter((p) =>
    servicio?.profesionales.includes(p.id),
  );

  function cambiar(f: () => void) {
    f();
    setHoras(null);
    setAviso(null);
  }

  function buscar() {
    if (!servicio) return;
    iniciar(async () => {
      const r = await buscarHorasLibres({
        localId,
        servicioId: servicio.id,
        profesionalId: profesionalId || null,
        desde: hoy,
      });
      if (!r.ok) {
        setHoras([]);
        setAviso(r.error);
        return;
      }
      setHoras(r.horas);
      setAviso(
        r.aviso ??
          (r.horas.length
            ? null
            : "No hay horas libres en los próximos 30 días."),
      );
    });
  }

  function elegir(h: HoraLibre) {
    if (!servicio) return;
    setAbierto(false);
    onElegir({
      tipo: "reserva",
      fecha: h.fecha,
      minuto: aMinutos(h.hora),
      profesionalId: h.profesionalId,
      servicio: {
        id: servicio.id,
        duracionMin: servicio.duracionMin,
        precio: servicio.precio,
      },
    });
  }

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger className="inline-flex h-11 md:h-10 items-center justify-center gap-2 rounded-full border border-ac-borde bg-ac-papel font-medium hover:bg-ac-niebla">
        <Search className="h-4 w-4" aria-hidden="true" /> Búsqueda rápida de
        hora
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(320px,calc(100vw-2rem))] space-y-3 p-4"
      >
        <p className="font-semibold">Primera hora libre</p>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Servicio</span>
          <select
            className={SELECTOR}
            value={servicioId}
            onChange={(e) =>
              cambiar(() => {
                setServicioId(e.target.value);
                setProfesionalId(CUALQUIERA);
              })
            }
          >
            <option value="">Elige el servicio</option>
            {servicios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Profesional</span>
          <select
            className={SELECTOR}
            value={profesionalId}
            disabled={!servicio}
            onChange={(e) => cambiar(() => setProfesionalId(e.target.value))}
          >
            <option value={CUALQUIERA}>Cualquiera disponible</option>
            {quienes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <Button
          className="w-full"
          disabled={!servicio || buscando}
          onClick={buscar}
        >
          {buscando ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : null}
          Buscar
        </Button>
        <div aria-live="polite">
          {aviso ? <p className="text-sm text-ac-pizarra">{aviso}</p> : null}
          {horas?.length ? (
            <ul className="mt-1 space-y-1.5" aria-label="Horas libres">
              {horas.map((h) => (
                <li key={`${h.fecha}-${h.hora}-${h.profesionalId}`}>
                  <button
                    type="button"
                    onClick={() => elegir(h)}
                    className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-ac-borde px-3 py-2 text-left text-sm hover:border-ac-laguna hover:bg-ac-laguna-claro md:min-h-0"
                  >
                    <span className="cifras font-medium first-letter:uppercase">
                      {cuando(h, hoy)}
                    </span>
                    <span className="truncate text-xs text-ac-pizarra">
                      {h.profesional}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
