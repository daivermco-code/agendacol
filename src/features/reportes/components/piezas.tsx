import type { ReactNode } from "react";
import { DIAS } from "@/shared/lib/formato";
import { cn } from "@/shared/lib/utils";
import {
  CALOR,
  CELDA_VACIA,
  cifra,
  DIAS_CORTOS,
  pasoCalor,
  SERIES,
  textoPorcentaje,
} from "../lib/graficos";
import { porcentaje } from "../lib/periodos";

/** Tarjeta de un gráfico o lista: título, una línea que dice qué se mide y el contenido. */
export function Panel({
  titulo,
  ayuda,
  accion,
  children,
  className,
}: {
  titulo: string;
  ayuda?: string;
  accion?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={titulo}
      className={cn(
        "min-w-0 rounded-lg border border-ac-borde bg-ac-papel p-4 shadow-quieta sm:p-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{titulo}</h2>
          {ayuda ? (
            <p className="mt-0.5 text-[13px] text-ac-pizarra">{ayuda}</p>
          ) : null}
        </div>
        {accion}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Leyenda de dos o más series: muestra + nombre en tinta (el color va en la muestra, nunca en el texto). */
export function Leyenda({
  series,
}: {
  series: { nombre: string; color: string }[];
}) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ac-pizarra">
      {series.map((s) => (
        <li key={s.nombre} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ background: s.color }}
            aria-hidden="true"
          />
          {s.nombre}
        </li>
      ))}
    </ul>
  );
}

/** Barras horizontales de una sola serie con el valor en la punta (y el del período anterior en gris, si hay). */
export function ListaBarras({
  filas,
  formato = cifra,
  vacio = "Sin datos en este período.",
}: {
  filas: { nombre: string; valor: number; anterior?: number | null }[];
  formato?: (n: number) => string;
  vacio?: string;
}) {
  const maximo = Math.max(...filas.map((f) => f.valor), 0);
  if (!filas.length || maximo === 0)
    return <p className="py-6 text-center text-sm text-ac-pizarra">{vacio}</p>;
  return (
    <ul className="space-y-3">
      {filas.map((f) => (
        <li key={f.nombre}>
          <div className="flex items-baseline gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate">{f.nombre}</span>
            <span className="cifras font-semibold">{formato(f.valor)}</span>
            {f.anterior != null ? (
              <span className="cifras w-20 text-right text-xs text-ac-neblina">
                antes {formato(f.anterior)}
              </span>
            ) : null}
          </div>
          <div
            className="mt-1 h-2 rounded-full bg-ac-niebla"
            aria-hidden="true"
          >
            <div
              className="h-2 rounded-full"
              style={{
                width: `${Math.max((f.valor / maximo) * 100, f.valor ? 2 : 0)}%`,
                background: SERIES[0],
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Parte de un todo en una sola barra (con 2 px de aire entre partes) y la leyenda con cifra y porcentaje. */
export function BarraPartes({
  partes,
  formato = cifra,
}: {
  partes: { nombre: string; valor: number; color: string }[];
  formato?: (n: number) => string;
}) {
  const total = partes.reduce((s, p) => s + p.valor, 0);
  return (
    <div>
      <div className="flex h-3 gap-[2px]" aria-hidden="true">
        {total === 0 ? (
          <div className="h-3 flex-1 rounded-full bg-ac-niebla-oscura" />
        ) : (
          partes
            .filter((p) => p.valor > 0)
            .map((p) => (
              <div
                key={p.nombre}
                className="h-3 first:rounded-l-full last:rounded-r-full"
                style={{ flexGrow: p.valor, background: p.color }}
              />
            ))
        )}
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {partes.map((p) => (
          <li key={p.nombre} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: p.color }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate">{p.nombre}</span>
            <span className="cifras font-semibold">{formato(p.valor)}</span>
            <span className="cifras w-14 text-right text-ac-pizarra">
              {textoPorcentaje(porcentaje(p.valor, total))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Mapa de calor día × hora: un tono, más oscuro donde hay más reservas; cada celda dice su cifra. */
export function MapaHoras({
  celdas,
}: {
  celdas: { dia: number; hora: number; reservas: number }[];
}) {
  const horas = celdas.map((c) => c.hora);
  const desde = Math.min(8, ...horas);
  const hasta = Math.max(19, ...horas);
  const columnas = Array.from(
    { length: hasta - desde + 1 },
    (_, i) => desde + i,
  );
  const valor = new Map(celdas.map((c) => [`${c.dia}-${c.hora}`, c.reservas]));
  const maximo = Math.max(0, ...celdas.map((c) => c.reservas));
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] table-fixed border-separate border-spacing-[2px] text-[11px]">
          <thead>
            <tr>
              <th scope="col" className="w-9">
                <span className="sr-only">Día</span>
              </th>
              {columnas.map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="cifras font-normal text-ac-pizarra"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DIAS_CORTOS.map((nombre, i) => (
              <tr key={nombre}>
                <th
                  scope="row"
                  className="pr-1 text-left font-normal text-ac-pizarra"
                >
                  {nombre}
                </th>
                {columnas.map((h) => {
                  const n = valor.get(`${i + 1}-${h}`) ?? 0;
                  const paso = pasoCalor(n, maximo);
                  return (
                    <td
                      key={h}
                      title={`${DIAS[i]} ${h}:00 · ${n} ${n === 1 ? "reserva" : "reservas"}`}
                      className="h-7 rounded-[3px] text-center"
                      style={{
                        background: paso < 0 ? CELDA_VACIA : CALOR[paso],
                      }}
                    >
                      <span className="sr-only">
                        {DIAS[i]} a las {h}:00: {n}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        className="mt-3 flex items-center justify-end gap-1.5 text-xs text-ac-pizarra"
        aria-hidden="true"
      >
        Menos
        {[CELDA_VACIA, ...CALOR].map((c) => (
          <span
            key={c}
            className="h-3 w-4 rounded-[3px]"
            style={{ background: c }}
          />
        ))}
        Más
      </div>
    </div>
  );
}

/** La tabla gemela de un gráfico (cada cifra también se puede leer sin el gráfico). */
export function VerDatos({
  columnas,
  filas,
}: {
  columnas: string[];
  filas: (string | number)[][];
}) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer py-3 text-[13px] font-medium text-ac-laguna hover:underline md:py-0">
        Ver los datos
      </summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-md border border-ac-borde">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 bg-ac-niebla">
            <tr>
              {columnas.map((c, i) => (
                <th
                  key={c}
                  scope="col"
                  className={cn(
                    "px-3 py-1.5 font-semibold",
                    i ? "text-right" : "text-left",
                  )}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={String(f[0])} className="border-t border-ac-borde">
                {f.map((v, i) => (
                  <td
                    key={i}
                    className={cn("px-3 py-1.5", i ? "cifras text-right" : "")}
                  >
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
