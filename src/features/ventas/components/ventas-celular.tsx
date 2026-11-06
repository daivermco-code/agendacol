"use client";

import { useState, type FormEvent } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  ReceiptText,
  Search,
  X,
} from "lucide-react";
import { usePuede } from "@/features/auth/components/proveedor-miembro";
import { useColumnas } from "@/shared/hooks/use-columnas";
import { enlaceExportar } from "@/shared/lib/csv";
import { pesos } from "@/shared/lib/formato";
import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/input";
import { COLUMNAS_VENTAS } from "../lib/columnas";
import {
  agruparPorDia,
  resumenVentas,
  valorVenta,
  type PropinaCelular,
  type VentaCelular,
} from "../lib/lista-celular";
import type { VistaVentas } from "../lib/periodo-celular";
import { usePanelVenta } from "../store/panel-venta";
import {
  CabeceraDia,
  FilaPropinaCelular,
  FilaVentaCelular,
} from "./fila-venta-celular";

export type PestanaVentas = "ventas" | "propinas";

interface Lista<T> {
  filas: T[];
  cortada: boolean;
}

interface Props {
  pestana: PestanaVentas;
  /** `null`: llegó un rango en la dirección (`desde`/`hasta`) y se muestra tal cual, sin flechas. */
  vista: VistaVentas | null;
  dia: string;
  periodo: {
    desde: string;
    hasta: string;
    anterior: string | null;
    siguiente: string | null;
    etiqueta: string;
  };
  q: string;
  hoy: string;
  /** `"error"`: la consulta falló (se avisa en vez de tumbar la página). */
  ventas: Lista<VentaCelular> | "error" | null;
  propinas: Lista<PropinaCelular> | "error" | null;
}

const FICHAS: { valor: VistaVentas; nombre: string }[] = [
  { valor: "hoy", nombre: "Hoy" },
  { valor: "semana", nombre: "Semana" },
  { valor: "mes", nombre: "Mes" },
];

const ICONO =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ac-tinta hover:bg-ac-niebla";
const FLECHA =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ac-niebla text-ac-tinta";

function Vacio({ propinas }: { propinas: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <span className="inline-flex h-[72px] w-[72px] items-center justify-center rounded-full bg-ac-niebla text-ac-pizarra">
        <ReceiptText className="h-8 w-8" aria-hidden="true" />
      </span>
      <p className="text-[18px] font-bold">
        {propinas
          ? "Sin propinas en este período"
          : "Sin ventas en este período"}
      </p>
      <p className="max-w-xs text-sm text-ac-pizarra">
        {propinas
          ? "Las propinas que se dejan al cobrar aparecerán aquí, agrupadas por día."
          : "Las ventas que cierres aparecerán aquí, agrupadas por día."}
      </p>
    </div>
  );
}

/**
 * Ventas en el celular (T-12.11): fichas Hoy / Semana / Mes, flechas y fecha, total grande y las ventas por día
 * (o las propinas). Cada fila abre el detalle; el botón flotante abre la Nueva venta.
 */
export function VentasCelular(p: Props) {
  const router = useRouter();
  const puedo = usePuede();
  const abrir = usePanelVenta((s) => s.abrir);
  const columnas = useColumnas("ventas", COLUMNAS_VENTAS);
  const [cargando, iniciar] = useTransicionRed();
  const [buscando, setBuscando] = useState(p.q !== "");
  // Con Atrás del navegador la página no se vuelve a montar: la caja sigue a la búsqueda de la dirección.
  const [qAnterior, setQAnterior] = useState(p.q);
  if (qAnterior !== p.q) {
    setQAnterior(p.q);
    setBuscando(p.q !== "");
  }
  const propinas = p.pestana === "propinas";

  /** Cambia la dirección conservando lo demás; elegir una ficha o un día deja el rango libre. */
  function ir(
    cambios: Partial<{
      pestana: PestanaVentas;
      vista: VistaVentas;
      dia: string;
      q: string;
    }>,
  ) {
    const u = new URLSearchParams();
    const libre = p.vista === null && !cambios.vista && !cambios.dia;
    const valores = {
      pestana: p.pestana,
      vista: p.vista ?? "hoy",
      dia: p.dia,
      q: p.q,
      ...cambios,
    };
    if (valores.pestana !== "ventas") u.set("pestana", valores.pestana);
    if (libre) {
      u.set("desde", p.periodo.desde);
      u.set("hasta", p.periodo.hasta);
    } else {
      if (valores.vista !== "hoy") u.set("vista", valores.vista);
      if (valores.dia !== p.hoy) u.set("dia", valores.dia);
    }
    if (valores.q) u.set("q", valores.q);
    const texto = u.toString();
    iniciar(() =>
      router.push(`/ventas/detalle${texto ? `?${texto}` : ""}`, {
        scroll: false,
      }),
    );
  }

  function buscar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
    ir({ q });
  }

  const fallo = (propinas ? p.propinas : p.ventas) === "error";
  const listaVentas = p.ventas === "error" ? null : p.ventas;
  const listaPropinas = p.propinas === "error" ? null : p.propinas;
  const resumen = listaVentas
    ? resumenVentas(listaVentas.filas)
    : { total: 0, n: 0 };
  const totalPropinas = (listaPropinas?.filas ?? []).reduce(
    (s, x) => s + x.propina,
    0,
  );
  const total = propinas ? totalPropinas : resumen.total;
  const n = propinas ? (listaPropinas?.filas.length ?? 0) : resumen.n;
  const cortada = propinas ? listaPropinas?.cortada : listaVentas?.cortada;

  return (
    <main className="px-4 pb-24 pt-1 md:hidden">
      <div className="flex items-center gap-1">
        <h1 className="flex-1 text-[28px] font-bold leading-tight">Ventas</h1>
        <button
          type="button"
          aria-label="Buscar ventas"
          aria-expanded={buscando}
          onClick={() => setBuscando((b) => !b)}
          className={ICONO}
        >
          <Search className="h-5 w-5" aria-hidden="true" />
        </button>
        {propinas ? null : (
          <a
            href={enlaceExportar(
              "ventas",
              { desde: p.periodo.desde, hasta: p.periodo.hasta, q: p.q },
              columnas.visibles,
            )}
            download
            aria-label="Exportar"
            className={ICONO}
          >
            <Download className="h-5 w-5" aria-hidden="true" />
          </a>
        )}
      </div>

      {buscando ? (
        <form role="search" onSubmit={buscar} className="mt-2 flex gap-2">
          <Input
            key={p.q}
            name="q"
            type="search"
            defaultValue={p.q}
            autoFocus
            aria-label="Número de venta o cliente"
            placeholder="Número de venta o cliente"
            maxLength={60}
          />
          {p.q ? (
            <button
              type="button"
              aria-label="Quitar la búsqueda"
              onClick={() => {
                setBuscando(false);
                ir({ q: "" });
              }}
              className={ICONO}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : null}
        </form>
      ) : null}

      <div
        role="tablist"
        aria-label="Ventas o propinas"
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          const otra = propinas ? "ventas" : "propinas";
          document.getElementById(`pestana-${otra}`)?.focus();
          ir({ pestana: otra });
        }}
        className="mt-3 grid grid-cols-2 border-b border-ac-borde"
      >
        {(["ventas", "propinas"] as const).map((t) => (
          <button
            key={t}
            id={`pestana-${t}`}
            type="button"
            role="tab"
            aria-selected={p.pestana === t}
            aria-controls="panel-ventas"
            tabIndex={p.pestana === t ? 0 : -1}
            onClick={() => ir({ pestana: t })}
            className={cn(
              "-mb-px min-h-11 border-b-2 text-[15px] font-semibold",
              p.pestana === t
                ? "border-ac-laguna text-ac-laguna-hondo"
                : "border-transparent text-ac-pizarra",
            )}
          >
            {t === "ventas" ? "Ventas" : "Propinas"}
          </button>
        ))}
      </div>

      <div role="group" aria-label="Período" className="mt-3 flex gap-2">
        {FICHAS.map((f) => {
          const activa = p.vista === f.valor;
          return (
            <button
              key={f.valor}
              type="button"
              aria-pressed={activa}
              onClick={() => ir({ vista: f.valor, dia: p.hoy })}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border px-4 text-[14px] font-semibold",
                activa
                  ? "border-ac-noche bg-ac-noche text-ac-sobre-noche"
                  : "border-ac-borde bg-ac-papel text-ac-tinta hover:bg-ac-niebla",
              )}
            >
              {f.nombre}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        {p.periodo.anterior ? (
          <button
            type="button"
            aria-label="Período anterior"
            onClick={() => ir({ dia: p.periodo.anterior ?? p.hoy })}
            className={FLECHA}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : null}
        <label className="relative flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-semibold focus-within:ring-2 focus-within:ring-ring">
          <CalendarDays
            className="h-4 w-4 text-ac-pizarra"
            aria-hidden="true"
          />
          <span className="first-letter:uppercase">{p.periodo.etiqueta}</span>
          <input
            type="date"
            aria-label={`${p.periodo.etiqueta}. Elegir fecha`}
            // En el rango libre no hay día elegido: así también se puede tocar hoy.
            value={p.vista === null ? "" : p.dia}
            max={p.hoy}
            onChange={(e) =>
              e.target.value &&
              ir({ vista: p.vista ?? "hoy", dia: e.target.value })
            }
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        {p.periodo.siguiente ? (
          <button
            type="button"
            aria-label="Período siguiente"
            onClick={() => ir({ dia: p.periodo.siguiente ?? p.hoy })}
            className={FLECHA}
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : p.periodo.anterior ? (
          <span className="h-11 w-11 shrink-0" aria-hidden="true" />
        ) : null}
      </div>

      <section
        id="panel-ventas"
        role="tabpanel"
        aria-labelledby={`pestana-${p.pestana}`}
        aria-busy={cargando}
        className={cn("transition-opacity", cargando && "opacity-60")}
      >
        <div className="mt-4">
          <p className="cifras text-[28px] font-bold leading-tight">
            {pesos(total)}
          </p>
          <p className="text-[16px] text-ac-pizarra">
            {n}{" "}
            {propinas
              ? n === 1
                ? "propina"
                : "propinas"
              : n === 1
                ? "venta"
                : "ventas"}
            {p.q ? ` · «${p.q}»` : ""}
          </p>
          {cortada ? (
            <p className="mt-1 text-xs text-ac-pizarra">
              El total y el conteo cuentan solo las 500 más recientes del
              período.
            </p>
          ) : null}
        </div>

        <div className="mt-4 space-y-6">
          {fallo ? (
            <p
              role="alert"
              className="rounded-lg bg-ac-niebla px-4 py-3 text-sm text-ac-error"
            >
              No pudimos cargar {propinas ? "las propinas" : "las ventas"}.
              Intenta de nuevo en un momento.
            </p>
          ) : propinas ? (
            listaPropinas?.filas.length ? (
              agruparPorDia(listaPropinas.filas, p.hoy, (x) => x.propina).map(
                (g) => (
                  <div key={g.dia}>
                    <CabeceraDia g={g} />
                    <ul aria-label={g.titulo}>
                      {g.filas.map((x) => (
                        <FilaPropinaCelular key={x.id} p={x} />
                      ))}
                    </ul>
                  </div>
                ),
              )
            ) : (
              <Vacio propinas />
            )
          ) : listaVentas?.filas.length ? (
            agruparPorDia(listaVentas.filas, p.hoy, valorVenta).map((g) => (
              <div key={g.dia}>
                <CabeceraDia g={g} />
                <ul aria-label={g.titulo}>
                  {g.filas.map((v) => (
                    <FilaVentaCelular key={v.id} v={v} />
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <Vacio propinas={false} />
          )}
        </div>
      </section>

      {puedo("cobrar") ? (
        <button
          type="button"
          data-guia="venta"
          onClick={() => abrir({}, { tipo: "ventas" })}
          className="fixed bottom-[var(--alto-pestanas)] right-4 z-30 inline-flex h-14 items-center gap-2 rounded-full bg-ac-laguna px-5 text-[15px] font-semibold text-ac-papel shadow-flota hover:bg-ac-laguna-hondo md:hidden print:hidden"
        >
          <Plus className="h-5 w-5" aria-hidden="true" /> Nueva venta
        </button>
      ) : null}
    </main>
  );
}
