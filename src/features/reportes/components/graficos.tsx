"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ANTERIOR, REJILLA, SERIES, TEXTO_EJE } from "../lib/graficos";
import { Leyenda } from "./piezas";

/** Una fila de un gráfico: la etiqueta del eje, la cifra actual y la del período comparado (si hay). */
export interface Punto {
  etiqueta: string;
  actual: number | null;
  anterior?: number | null;
  /** Lo que dice el globo para el período comparado (p. ej., su fecha). */
  etiquetaAnterior?: string;
}

type Formato = "cifra" | "pesos" | "porcentaje";

const FORMATOS: Record<Formato, (n: number) => string> = {
  cifra: (n) => new Intl.NumberFormat("es-CO").format(n),
  pesos: (n) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    })
      .format(n)
      .replace(/\s/g, ""),
  porcentaje: (n) =>
    `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(n)} %`,
};

const EJE: Record<Formato, (n: number) => string> = {
  cifra: FORMATOS.cifra,
  porcentaje: (n) => `${n} %`,
  pesos: (n) =>
    Math.abs(n) >= 1_000_000
      ? `$${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(n / 1_000_000)} M`
      : Math.abs(n) >= 1_000
        ? `$${Math.round(n / 1_000)} mil`
        : `$${n}`,
};

const TICK = { fill: TEXTO_EJE, fontSize: 12 };

interface FilaGlobo {
  dataKey?: unknown;
  value?: unknown;
  color?: string;
  payload?: Punto;
}

/** Globo al pasar el mouse (o el dedo): la etiqueta y cada serie con su muestra de color. */
function Globo({
  activo,
  filas,
  titulo,
  formato,
  nombres,
}: {
  activo?: boolean;
  filas?: readonly FilaGlobo[];
  titulo?: unknown;
  formato: Formato;
  nombres: { actual: string; anterior: string };
}) {
  if (!activo || !filas?.length) return null;
  return (
    <div className="rounded-md border border-ac-borde bg-ac-papel px-3 py-2 text-[13px] shadow-flota">
      <p className="font-semibold">{String(titulo ?? "")}</p>
      {filas.map((f) => {
        const clave = String(f.dataKey);
        const extra =
          clave === "anterior" && f.payload?.etiquetaAnterior
            ? ` (${f.payload.etiquetaAnterior})`
            : "";
        return (
          <p key={clave} className="mt-0.5 flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: f.color }}
              aria-hidden="true"
            />
            <span className="text-ac-pizarra">
              {clave === "anterior" ? nombres.anterior : nombres.actual}
              {extra}:
            </span>
            <span className="cifras font-semibold">
              {typeof f.value === "number" ? FORMATOS[formato](f.value) : "—"}
            </span>
          </p>
        );
      })}
    </div>
  );
}

const NOMBRES = { actual: "Este período", anterior: "Período comparado" };

/** Guarda el alto del gráfico y lo dibuja cuando entra en pantalla: en un celular lento (CPU 4×), dibujar los que
 * quedan abajo bloqueaba la primera carga del inicio ~350 ms; así queda en ~130 (auditoría del 1-nov-2026). Sin
 * margen a propósito: con 200 px, el de ventas (justo debajo del borde) se dibujaba igual al abrir. */
function Lienzo({ alto, children }: { alto: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: "0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className="mt-2" style={{ height: alto }}>
      {visible ? children : null}
    </div>
  );
}

/** Columnas (p. ej., por día de la semana): una serie, o la actual junto a la comparada en gris. */
export function Columnas({
  datos,
  formato = "cifra",
  alto = 220,
  nombres = NOMBRES,
}: {
  datos: Punto[];
  formato?: Formato;
  alto?: number;
  nombres?: { actual: string; anterior: string };
}) {
  const conAnterior = datos.some((d) => d.anterior != null);
  return (
    <div>
      {conAnterior ? (
        <Leyenda
          series={[
            { nombre: nombres.actual, color: SERIES[0] },
            { nombre: nombres.anterior, color: ANTERIOR },
          ]}
        />
      ) : null}
      <Lienzo alto={alto}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={datos}
            margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
            barGap={2}
          >
            <CartesianGrid vertical={false} stroke={REJILLA} />
            <XAxis
              dataKey="etiqueta"
              tickLine={false}
              axisLine={{ stroke: REJILLA }}
              tick={TICK}
              interval={0}
            />
            <YAxis
              tickFormatter={EJE[formato]}
              width={formato === "pesos" ? 64 : 40}
              tickLine={false}
              axisLine={false}
              tick={TICK}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--ac-niebla))" }}
              content={(p) => (
                <Globo
                  activo={p.active}
                  filas={p.payload as readonly FilaGlobo[] | undefined}
                  titulo={p.label}
                  formato={formato}
                  nombres={nombres}
                />
              )}
            />
            {conAnterior ? (
              <Bar
                dataKey="anterior"
                fill={ANTERIOR}
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                isAnimationActive={false}
              />
            ) : null}
            <Bar
              dataKey="actual"
              fill={SERIES[0]}
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </Lienzo>
    </div>
  );
}

/** Línea en el tiempo: el período actual y, alineado por día, el comparado en gris. */
export function Linea({
  datos,
  formato = "cifra",
  alto = 240,
  nombres = NOMBRES,
}: {
  datos: Punto[];
  formato?: Formato;
  alto?: number;
  nombres?: { actual: string; anterior: string };
}) {
  const conAnterior = datos.some((d) => d.anterior != null);
  const punto = { r: 5, stroke: "hsl(var(--ac-papel))", strokeWidth: 2 };
  return (
    <div>
      {conAnterior ? (
        <Leyenda
          series={[
            { nombre: nombres.actual, color: SERIES[0] },
            { nombre: nombres.anterior, color: ANTERIOR },
          ]}
        />
      ) : null}
      <Lienzo alto={alto}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={datos}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke={REJILLA} />
            <XAxis
              dataKey="etiqueta"
              tickLine={false}
              axisLine={{ stroke: REJILLA }}
              tick={TICK}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={EJE[formato]}
              width={formato === "pesos" ? 64 : 40}
              tickLine={false}
              axisLine={false}
              tick={TICK}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ stroke: "hsl(var(--ac-borde-fuerte))", strokeWidth: 1 }}
              content={(p) => (
                <Globo
                  activo={p.active}
                  filas={p.payload as readonly FilaGlobo[] | undefined}
                  titulo={p.label}
                  formato={formato}
                  nombres={nombres}
                />
              )}
            />
            {conAnterior ? (
              <Line
                dataKey="anterior"
                stroke={ANTERIOR}
                strokeWidth={2}
                dot={false}
                activeDot={{ ...punto, fill: ANTERIOR }}
                isAnimationActive={false}
              />
            ) : null}
            <Line
              dataKey="actual"
              stroke={SERIES[0]}
              strokeWidth={2}
              dot={false}
              activeDot={{ ...punto, fill: SERIES[0] }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </Lienzo>
    </div>
  );
}
