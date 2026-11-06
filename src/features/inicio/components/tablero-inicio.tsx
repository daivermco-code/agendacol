import type { ReactNode } from "react";
import Link from "next/link";
import {
  BarChart3,
  CalendarRange,
  Globe,
  Search,
  Target,
  type LucideIcon,
} from "lucide-react";
import { CampanaAvisos } from "@/features/avisos/components/campana-avisos";
import { BarraPartes } from "@/features/reportes/components/piezas";
import { StockBajo } from "@/features/reportes/components/resumen";
import { SERIES } from "@/features/reportes/lib/graficos";
import { pesos } from "@/shared/lib/formato";
import type { DatosTablero } from "../types";
import { TarjetaSugerencia } from "./tarjeta-sugerencia";

const ICONO_CABECERA =
  "inline-flex h-11 w-11 items-center justify-center rounded-full text-ac-sobre-noche hover:bg-white/10";

/**
 * Inicio del celular (T-12.9): saludo en una cabecera de color y, debajo, tarjetas apiladas. Desde la tableta
 * se sigue viendo el Resumen de siempre.
 */
export function TableroInicio({
  nombre,
  negocio,
  fecha,
  datos,
  masNuevo,
}: {
  nombre: string;
  negocio: string;
  /** "Jueves 5 de noviembre". */
  fecha: string;
  /** null si no se pudo leer. */
  datos: DatosTablero | null;
  /** Fecha del aviso más nuevo, para el punto de la campana. */
  masNuevo: string | null;
}) {
  return (
    <main className="md:hidden">
      <header className="bg-ac-noche px-4 pb-10 pt-3 text-ac-sobre-noche">
        <div className="flex items-center justify-end gap-1">
          <Link href="/buscar" aria-label="Buscar" className={ICONO_CABECERA}>
            <Search className="h-5 w-5" aria-hidden="true" />
          </Link>
          <CampanaAvisos masNuevo={masNuevo} className={ICONO_CABECERA} />
        </div>
        <p className="text-[13px] font-medium text-ac-sobre-noche-suave first-letter:uppercase">
          {fecha}
        </p>
        <h1 className="text-[26px] font-bold leading-tight">Hola, {nombre}</h1>
        <p className="text-[15px] text-ac-sobre-noche-suave">
          Así va {negocio}
        </p>
      </header>
      <div className="relative -mt-6 space-y-3 rounded-t-[28px] bg-ac-papel px-4 pb-6 pt-5">
        {datos ? (
          <Tarjetas datos={datos} negocio={negocio} />
        ) : (
          <div role="alert" className="space-y-3 py-6 text-center">
            <p className="text-[15px] text-ac-pizarra">
              No se pudo cargar el tablero.
            </p>
            {/* Las páginas dinámicas se vuelven a pedir al servidor al navegar a ellas. */}
            <Link
              href="/"
              prefetch={false}
              className="inline-flex h-11 items-center rounded-full border border-ac-borde px-4 text-[14px] font-semibold"
            >
              Reintentar
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

function Tarjetas({
  datos,
  negocio,
}: {
  datos: DatosTablero;
  negocio: string;
}) {
  const { semana, meta, indicadores, origen } = datos;
  return (
    <>
      {datos.sugerencia ? (
        <TarjetaSugerencia sugerencia={datos.sugerencia} negocio={negocio} />
      ) : null}

      <Tarjeta
        titulo="Esta semana"
        icono={CalendarRange}
        pie="En los últimos 7 días"
      >
        <div className="grid grid-cols-2 gap-3">
          <Cifra
            valor={String(semana.reservasNuevas)}
            texto={
              semana.reservasNuevas === 1 ? "reserva nueva" : "reservas nuevas"
            }
          />
          {semana.ingresos === null ? null : (
            <Cifra valor={pesos(semana.ingresos)} texto="en ventas" />
          )}
        </div>
      </Tarjeta>

      <Tarjeta titulo="Meta del mes" icono={Target}>
        {meta.objetivo === null ? (
          <p className="cifras text-[24px] font-bold">
            {meta.actual} {meta.actual === 1 ? "reserva" : "reservas"}
            <span className="block text-[14px] font-normal text-ac-pizarra">
              El mes pasado no hubo reservas para comparar
            </span>
          </p>
        ) : (
          <>
            <p className="cifras text-[24px] font-bold">
              {meta.actual} de {meta.objetivo} reservas
            </p>
            <div
              role="progressbar"
              aria-label="Reservas del mes contra el mes pasado"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={meta.porcentaje}
              className="mt-2 h-2 overflow-hidden rounded-full bg-ac-niebla"
            >
              <div
                className="h-full rounded-full bg-ac-laguna"
                style={{ width: `${meta.porcentaje}%` }}
              />
            </div>
            <p className="mt-2 text-[13px] text-ac-pizarra">
              {meta.superada
                ? "Ya pasaste las reservas del mes pasado"
                : `Te faltan ${meta.objetivo - meta.actual} para igualar el mes pasado`}
            </p>
          </>
        )}
      </Tarjeta>

      <Tarjeta titulo="Indicadores" icono={BarChart3}>
        <dl className="grid grid-cols-2 gap-2">
          <Indicador
            nombre="Retención"
            valor={
              indicadores.retencion === null
                ? "—"
                : `${indicadores.retencion} %`
            }
            periodo="Últimos 90 días"
          />
          {!indicadores.ventas ||
          indicadores.ingresoEstimado === null ? null : (
            <Indicador
              nombre="Ingreso estimado"
              valor={pesos(indicadores.ingresoEstimado)}
              periodo="Este mes"
            />
          )}
          <Indicador
            nombre="Clientes nuevos"
            valor={String(indicadores.clientesNuevos)}
            periodo="Este mes"
          />
          {!indicadores.ventas ? null : (
            <Indicador
              nombre="Ticket promedio"
              valor={
                indicadores.ticketPromedio === null
                  ? "—"
                  : pesos(indicadores.ticketPromedio)
              }
              periodo="Este mes"
            />
          )}
        </dl>
      </Tarjeta>

      <Tarjeta titulo="Origen de las reservas" icono={Globe} extra="Este mes">
        <BarraPartes
          partes={[
            {
              nombre: "Desde la agenda",
              valor: origen.agenda,
              color: SERIES[0],
            },
            {
              nombre: "Sitio de reservas",
              valor: origen.enLinea,
              color: SERIES[1],
            },
          ]}
        />
      </Tarjeta>

      {datos.stock && datos.stock.length > 0 ? (
        <StockBajo productos={datos.stock} />
      ) : null}
    </>
  );
}

function Tarjeta({
  titulo,
  icono: Icono,
  extra,
  pie,
  children,
}: {
  titulo: string;
  icono: LucideIcon;
  extra?: string;
  pie?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={titulo}
      className="rounded-3xl border border-ac-borde bg-ac-papel p-4"
    >
      <h2 className="mb-3 flex items-center gap-2 text-[17px] font-bold">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ac-laguna-claro text-ac-laguna">
          <Icono className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="flex-1">{titulo}</span>
        {extra ? (
          <span className="text-[13px] font-normal text-ac-pizarra">
            {extra}
          </span>
        ) : null}
      </h2>
      {children}
      {pie ? <p className="mt-3 text-[13px] text-ac-pizarra">{pie}</p> : null}
    </section>
  );
}

function Cifra({ valor, texto }: { valor: string; texto: string }) {
  return (
    <p>
      <span className="cifras block truncate text-[28px] font-bold leading-tight">
        {valor}
      </span>
      <span className="text-[14px] text-ac-pizarra">{texto}</span>
    </p>
  );
}

function Indicador({
  nombre,
  valor,
  periodo,
}: {
  nombre: string;
  valor: string;
  periodo: string;
}) {
  return (
    <div className="rounded-2xl bg-ac-niebla p-3">
      <dt className="text-[13px] text-ac-pizarra">{nombre}</dt>
      <dd className="cifras truncate text-[20px] font-bold">{valor}</dd>
      <dd className="text-[12px] text-ac-pizarra">{periodo}</dd>
    </div>
  );
}
