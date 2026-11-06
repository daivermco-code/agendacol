import Link from "next/link";
import { BellRing, Cake, ChevronDown, PackageX } from "lucide-react";
import { ESTADOS } from "@/features/agenda/lib/estados";
import { DIAS, pesos, telefono } from "@/shared/lib/formato";
import { DIAS_CORTOS, SERIES, textoPorcentaje } from "../lib/graficos";
import { porcentaje } from "../lib/periodos";
import type {
  AvisosPeriodo,
  CitaDeHoy,
  Comparadas,
  Cumpleanero,
  ProductoBajo,
} from "../services/reportes";
import type {
  EstadisticasReservas,
  EstadisticasVentas,
  PeriodoReporte,
} from "../types";
import { Columnas, type Punto } from "./graficos";
import { BarraPartes, Panel, VerDatos } from "./piezas";
import { TarjetaCifra } from "./tarjeta-cifra";

export interface DatosResumen {
  periodo: PeriodoReporte;
  reservas: Comparadas<EstadisticasReservas>;
  ventas: Comparadas<EstadisticasVentas> | null;
  hoy: CitaDeHoy[];
  cumpleanos: Cumpleanero[];
  avisos: AvisosPeriodo;
  stock: ProductoBajo[] | null;
}

const ocupacion = (r: {
  minutosReservados: number;
  minutosDisponibles: number;
}) => porcentaje(r.minutosReservados, r.minutosDisponibles);

function Tarjetas({
  reservas,
  ventas,
}: Pick<DatosResumen, "reservas" | "ventas">) {
  const a = reservas.actual;
  const b = reservas.anterior;
  return (
    <section
      aria-label="Cifras del período"
      className="grid grid-cols-2 gap-3 xl:grid-cols-4"
    >
      <TarjetaCifra
        oscura
        titulo="Reservas"
        valor={String(a.activas)}
        ayuda={`Sin contar ${a.porEstado.cancelado ?? 0} canceladas`}
        actual={a.activas}
        anterior={b?.activas ?? null}
      />
      <TarjetaCifra
        titulo="Factor de ocupación"
        valor={textoPorcentaje(ocupacion(a))}
        ayuda="Horas reservadas sobre las horas del equipo"
        actual={ocupacion(a)}
        anterior={b ? ocupacion(b) : null}
        textoAnterior={b ? textoPorcentaje(ocupacion(b)) : undefined}
        puntos
      />
      <TarjetaCifra
        titulo="Clientes nuevos"
        valor={String(a.nuevosClientes)}
        ayuda="Registrados en el período"
        actual={a.nuevosClientes}
        anterior={b?.nuevosClientes ?? null}
      />
      {ventas ? (
        <TarjetaCifra
          titulo="Ventas facturadas"
          valor={pesos(ventas.actual.total)}
          ayuda={`${ventas.actual.cantidad} ventas, sin las anuladas`}
          actual={ventas.actual.total}
          anterior={ventas.anterior?.total ?? null}
          textoAnterior={
            ventas.anterior ? pesos(ventas.anterior.total) : undefined
          }
        />
      ) : null}
    </section>
  );
}

function ReservasDeHoy({ citas }: { citas: CitaDeHoy[] }) {
  return (
    <details
      className="group rounded-lg border border-ac-borde bg-ac-papel shadow-quieta"
      open={citas.length > 0 && citas.length <= 6}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 sm:px-5 [&::-webkit-details-marker]:hidden">
        <h2 className="flex-1 font-semibold">
          Reservas de hoy{" "}
          <span className="cifras font-normal text-ac-pizarra">
            · {citas.length}
          </span>
        </h2>
        <ChevronDown
          className="h-5 w-5 text-ac-pizarra transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="border-t border-ac-borde px-4 py-2 sm:px-5">
        {citas.length === 0 ? (
          <p className="py-4 text-sm text-ac-pizarra">
            No hay reservas para hoy.
          </p>
        ) : (
          <ul className="divide-y divide-ac-borde">
            {citas.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="cifras w-12 shrink-0 font-semibold">
                  {c.hora}
                </span>
                <span
                  className="h-8 w-1 shrink-0 rounded-full"
                  style={{ background: c.color }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <Link
                    href={`/clientes/${c.clienteId}`}
                    className="block truncate font-medium hover:text-ac-laguna hover:underline"
                  >
                    {c.cliente}
                  </Link>
                  <span className="block truncate text-xs text-ac-pizarra">
                    {c.servicio} · {c.profesional}
                  </span>
                </span>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    background: ESTADOS[c.estado].fondo,
                    color: ESTADOS[c.estado].texto,
                  }}
                >
                  {ESTADOS[c.estado].nombre}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/agenda"
          className="area-tactil my-2 inline-block text-sm font-semibold text-ac-laguna hover:underline"
        >
          Abrir la agenda
        </Link>
      </div>
    </details>
  );
}

function puntosOcupacion(r: Comparadas<EstadisticasReservas>): Punto[] {
  return r.actual.porDia.map((d, i) => {
    const antes = r.anterior?.porDia[i];
    return {
      etiqueta: DIAS_CORTOS[i],
      actual: d.minutosDisponibles ? ocupacion(d) : null,
      anterior: antes && antes.minutosDisponibles ? ocupacion(antes) : null,
    };
  });
}

function Origen({ reservas }: { reservas: Comparadas<EstadisticasReservas> }) {
  const { agenda, enLinea } = reservas.actual.porOrigen;
  const antes = reservas.anterior?.porOrigen;
  return (
    <Panel
      titulo="Origen de las reservas"
      ayuda="Reservas en pie del período, según por dónde entraron"
    >
      <BarraPartes
        partes={[
          { nombre: "Reservas en línea", valor: enLinea, color: SERIES[0] },
          { nombre: "Desde la agenda", valor: agenda, color: SERIES[1] },
        ]}
      />
      {antes ? (
        <p className="mt-3 border-t border-ac-borde pt-3 text-[13px] text-ac-pizarra">
          Antes:{" "}
          {textoPorcentaje(
            porcentaje(antes.enLinea, antes.enLinea + antes.agenda),
          )}{" "}
          en línea ({antes.enLinea} de {antes.enLinea + antes.agenda})
        </p>
      ) : null}
    </Panel>
  );
}

function Graficos({
  reservas,
  ventas,
}: Pick<DatosResumen, "reservas" | "ventas">) {
  const ocupacionDias = puntosOcupacion(reservas);
  const ventasDias: Punto[] | null = ventas
    ? ventas.actual.porDia.map((d, i) => ({
        etiqueta: DIAS_CORTOS[i],
        actual: d.total,
        anterior: ventas.anterior?.porDia[i].total ?? null,
      }))
    : null;
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <Panel
        titulo="Ocupación por día"
        ayuda="Porcentaje de las horas del equipo que quedaron reservadas"
      >
        <Columnas datos={ocupacionDias} formato="porcentaje" />
        <VerDatos
          columnas={["Día", "Este período", "Comparado"]}
          filas={ocupacionDias.map((d, i) => [
            DIAS[i],
            d.actual == null ? "Cerrado" : textoPorcentaje(d.actual),
            d.anterior == null ? "—" : textoPorcentaje(d.anterior),
          ])}
        />
      </Panel>
      <Origen reservas={reservas} />
      {ventasDias ? (
        <Panel
          titulo="Ventas facturadas por día"
          ayuda="Total vendido cada día de la semana, sin las anuladas"
        >
          <Columnas datos={ventasDias} formato="pesos" />
          <VerDatos
            columnas={["Día", "Este período", "Comparado"]}
            filas={ventasDias.map((d, i) => [
              DIAS[i],
              pesos(d.actual ?? 0),
              d.anterior == null ? "—" : pesos(d.anterior),
            ])}
          />
        </Panel>
      ) : null}
    </div>
  );
}

function Avisos({ avisos }: { avisos: AvisosPeriodo }) {
  return (
    <Panel
      titulo="Avisos enviados"
      ayuda="Correos y WhatsApp simulados del período (confirmaciones y recordatorios)"
    >
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          ["Correos", avisos.correo],
          ["WhatsApp", avisos.whatsapp],
          ["Recordatorios", avisos.recordatorios],
        ].map(([nombre, n]) => (
          <div
            key={nombre}
            className="flex flex-col-reverse rounded-md bg-ac-niebla px-2 py-3"
          >
            <dt className="text-xs text-ac-pizarra">{nombre}</dt>
            <dd className="text-2xl font-bold">{n}</dd>
          </div>
        ))}
      </dl>
      {avisos.correo + avisos.whatsapp === 0 ? (
        <p className="mt-3 text-[13px] text-ac-pizarra">
          Aún no salen avisos en este período: salen al crear, confirmar o
          recordar una cita.
        </p>
      ) : null}
      <Link
        href="/demo/buzon"
        className="area-tactil mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ac-laguna hover:underline"
      >
        <BellRing className="h-4 w-4" aria-hidden="true" /> Abrir el buzón de la
        demo
      </Link>
    </Panel>
  );
}

function Cumpleanos({ clientes }: { clientes: Cumpleanero[] }) {
  return (
    <Panel titulo="Cumpleaños de hoy" ayuda="Un buen día para escribirles">
      {clientes.length === 0 ? (
        <p className="flex items-center gap-2 py-3 text-sm text-ac-pizarra">
          <Cake className="h-4 w-4 text-ac-neblina" aria-hidden="true" /> Hoy
          nadie cumple años.
        </p>
      ) : (
        <ul className="divide-y divide-ac-borde">
          {clientes.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2 text-sm">
              <Cake
                className="h-4 w-4 shrink-0 text-ac-laguna"
                aria-hidden="true"
              />
              <Link
                href={`/clientes/${c.id}`}
                className="min-w-0 flex-1 truncate font-medium hover:underline"
              >
                {c.nombre}
              </Link>
              <span className="cifras text-xs text-ac-pizarra">
                {telefono(c.telefono)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function StockBajo({ productos }: { productos: ProductoBajo[] }) {
  return (
    <Panel titulo="Stock bajo" ayuda="Productos en su mínimo o por debajo">
      {productos.length === 0 ? (
        <p className="py-3 text-sm text-ac-pizarra">
          Todos los productos tienen existencias suficientes.
        </p>
      ) : (
        <ul className="divide-y divide-ac-borde">
          {productos.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2 text-sm">
              <PackageX
                className="h-4 w-4 shrink-0 text-ac-aviso"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate">{p.nombre}</span>
              <span className="cifras text-xs font-semibold">
                {p.existencias === 0 ? "Agotado" : `Quedan ${p.existencias}`}
                <span className="font-normal text-ac-pizarra">
                  {" "}
                  · mínimo {p.minimo}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/administracion/productos?bajo=1"
        className="area-tactil mt-3 inline-block text-sm font-semibold text-ac-laguna hover:underline"
      >
        Ver el inventario
      </Link>
    </Panel>
  );
}

/** El Resumen: cuatro cifras del período, las reservas de hoy, ocupación, origen, ventas y lo del día. */
export function Resumen({ datos }: { datos: DatosResumen }) {
  return (
    <div className="space-y-4">
      <Tarjetas reservas={datos.reservas} ventas={datos.ventas} />
      <ReservasDeHoy citas={datos.hoy} />
      <Graficos reservas={datos.reservas} ventas={datos.ventas} />
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Cumpleanos clientes={datos.cumpleanos} />
        <Avisos avisos={datos.avisos} />
        {datos.stock ? <StockBajo productos={datos.stock} /> : null}
      </div>
    </div>
  );
}
