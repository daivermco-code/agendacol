"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";
import { ESTADOS, ORDEN_ESTADOS } from "@/features/agenda/lib/estados";
import { RangoFechas } from "@/shared/components/rango-fechas";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import type { FiltrosClientes } from "../services/clientes";

export type FiltrosAvanzados = Pick<
  FiltrosClientes,
  | "profesional"
  | "servicio"
  | "estado"
  | "genero"
  | "cumpleDesde"
  | "cumpleHasta"
  | "creadoDesde"
  | "creadoHasta"
  | "reservo"
>;

export const SIN_FILTROS: FiltrosAvanzados = {
  profesional: "",
  servicio: "",
  estado: "",
  genero: "",
  cumpleDesde: "",
  cumpleHasta: "",
  creadoDesde: "",
  creadoHasta: "",
  reservo: "",
};

const SELECTOR =
  "h-11 w-full md:h-9 rounded-md border border-input bg-ac-papel px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

function Seccion({
  titulo,
  plegable,
  activa,
  children,
}: {
  titulo: string;
  plegable?: boolean;
  activa?: boolean;
  children: ReactNode;
}) {
  const [abierta, setAbierta] = useState(!plegable || Boolean(activa));
  return (
    <div className="space-y-2 border-b border-ac-borde px-4 py-3 last:border-b-0">
      {plegable ? (
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-between text-sm font-semibold md:min-h-0"
          aria-expanded={abierta}
          onClick={() => setAbierta((v) => !v)}
        >
          {titulo}
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              abierta && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
      ) : (
        <p className="text-sm font-semibold">{titulo}</p>
      )}
      {abierta ? children : null}
    </div>
  );
}

function Opciones({
  nombre,
  valor,
  opciones,
  onCambio,
}: {
  nombre: string;
  valor: string;
  opciones: { valor: string; nombre: string }[];
  onCambio: (v: string) => void;
}) {
  return (
    <div className="grid gap-1.5" role="radiogroup" aria-label={nombre}>
      {[{ valor: "", nombre: "Todos" }, ...opciones].map((o) => (
        <label
          key={o.valor}
          className="flex min-h-11 items-center gap-2 text-sm md:min-h-0"
        >
          <input
            type="radio"
            name={nombre}
            className="h-4 w-4 accent-ac-laguna"
            checked={valor === o.valor}
            onChange={() => onCambio(o.valor)}
          />
          {o.nombre}
        </label>
      ))}
    </div>
  );
}

/** Columna de filtros avanzados con Buscar / Reestablecer (en tableta vertical, plegable arriba de la tabla). */
export function FiltrosClientesPanel({
  inicial,
  profesionales,
  servicios,
  onAplicar,
}: {
  inicial: FiltrosAvanzados;
  profesionales: { id: string; nombre: string }[];
  servicios: { id: string; nombre: string }[];
  onAplicar: (f: FiltrosAvanzados) => void;
}) {
  const [f, setF] = useState<FiltrosAvanzados>(inicial);
  const activos = (Object.keys(SIN_FILTROS) as (keyof FiltrosAvanzados)[]).filter(
    (k) => inicial[k] !== "",
  ).length;
  const [abierto, setAbierto] = useState(activos > 0);
  const poner = (cambio: Partial<FiltrosAvanzados>) =>
    setF((x) => ({ ...x, ...cambio }));

  return (
    <section
      aria-label="Filtros avanzados"
      className="rounded-lg border border-ac-borde bg-ac-papel shadow-quieta"
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 border-b border-ac-borde px-4 py-3.5 text-left font-semibold lg:pointer-events-none"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        <SlidersHorizontal
          className="h-4 w-4 text-ac-pizarra"
          aria-hidden="true"
        />
        <span className="flex-1">Filtros avanzados</span>
        {activos ? (
          <span className="rounded-full bg-ac-laguna-claro px-2 text-xs font-semibold text-ac-laguna-hondo">
            {activos}
          </span>
        ) : null}
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform lg:hidden",
            abierto && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      <div className={cn(!abierto && "hidden lg:block")}>
        <Seccion titulo="Profesional">
          <select
            aria-label="Profesional"
            className={SELECTOR}
            value={f.profesional}
            onChange={(e) => poner({ profesional: e.target.value })}
          >
            <option value="">Selecciona…</option>
            {profesionales.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Seccion>
        <Seccion titulo="Servicios">
          <select
            aria-label="Servicio"
            className={SELECTOR}
            value={f.servicio}
            onChange={(e) => poner({ servicio: e.target.value })}
          >
            <option value="">Selecciona…</option>
            {servicios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </Seccion>
        <Seccion
          titulo="Estado de la reserva"
          plegable
          activa={Boolean(f.estado)}
        >
          <Opciones
            nombre="estado-reserva"
            valor={f.estado}
            opciones={ORDEN_ESTADOS.map((e) => ({
              valor: e,
              nombre: ESTADOS[e].nombre,
            }))}
            onCambio={(v) => poner({ estado: v as FiltrosAvanzados["estado"] })}
          />
        </Seccion>
        <Seccion titulo="Género" plegable activa={Boolean(f.genero)}>
          <Opciones
            nombre="genero"
            valor={f.genero}
            opciones={[
              { valor: "femenino", nombre: "Femenino" },
              { valor: "masculino", nombre: "Masculino" },
              { valor: "otro", nombre: "Otro" },
            ]}
            onCambio={(v) => poner({ genero: v as FiltrosAvanzados["genero"] })}
          />
        </Seccion>
        <Seccion titulo="Cumpleaños">
          <RangoFechas
            id="filtro-cumple"
            sinAno
            valor={{ desde: f.cumpleDesde, hasta: f.cumpleHasta }}
            onCambio={(r) =>
              poner({ cumpleDesde: r.desde, cumpleHasta: r.hasta })
            }
          />
        </Seccion>
        <Seccion titulo="Cliente creado en el período">
          <RangoFechas
            id="filtro-creado"
            valor={{ desde: f.creadoDesde, hasta: f.creadoHasta }}
            onCambio={(r) =>
              poner({ creadoDesde: r.desde, creadoHasta: r.hasta })
            }
          />
        </Seccion>
        <Seccion titulo="¿Ha reservado?" plegable activa={Boolean(f.reservo)}>
          <Opciones
            nombre="ha-reservado"
            valor={f.reservo}
            opciones={[
              { valor: "si", nombre: "Sí" },
              { valor: "no", nombre: "No" },
            ]}
            onCambio={(v) =>
              poner({ reservo: v as FiltrosAvanzados["reservo"] })
            }
          />
        </Seccion>
        <div className="space-y-2 p-4">
          <Button type="button" className="w-full" onClick={() => onAplicar(f)}>
            Buscar
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setF(SIN_FILTROS);
              onAplicar(SIN_FILTROS);
            }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reestablecer
          </Button>
        </div>
      </div>
    </section>
  );
}
