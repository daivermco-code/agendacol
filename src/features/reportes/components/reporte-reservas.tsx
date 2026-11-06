import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ESTADOS, ORDEN_ESTADOS } from "@/features/agenda/lib/estados";
import { pesos } from "@/shared/lib/formato";
import { SERIES, textoPorcentaje } from "../lib/graficos";
import { porcentaje } from "../lib/periodos";
import type { Comparadas } from "../services/reportes";
import type { EstadisticasReservas } from "../types";
import { Linea, type Punto } from "./graficos";
import { BarraPartes, ListaBarras, MapaHoras, Panel, VerDatos } from "./piezas";
import { TarjetaCifra } from "./tarjeta-cifra";

type Datos = Comparadas<EstadisticasReservas>;

const ocupacion = (r: {
  minutosReservados: number;
  minutosDisponibles: number;
}) => porcentaje(r.minutosReservados, r.minutosDisponibles);
/** Inasistencias sobre las citas que ya se resolvieron (asistió o no). */
const tasaInasistencia = (r: EstadisticasReservas) =>
  porcentaje(r.inasistencias, r.inasistencias + r.asistencias);
const corta = (f: string) => format(parseISO(f), "d MMM", { locale: es });

function Tarjetas({ actual: a, anterior: b }: Datos) {
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
        titulo="Ocupación"
        valor={textoPorcentaje(ocupacion(a))}
        ayuda="Horas reservadas sobre las horas del equipo"
        actual={ocupacion(a)}
        anterior={b ? ocupacion(b) : null}
        textoAnterior={b ? textoPorcentaje(ocupacion(b)) : undefined}
        puntos
      />
      <TarjetaCifra
        titulo="Tasa de inasistencias"
        valor={textoPorcentaje(tasaInasistencia(a))}
        ayuda={`${a.inasistencias} de ${a.inasistencias + a.asistencias} citas atendidas o perdidas`}
        actual={tasaInasistencia(a)}
        anterior={b ? tasaInasistencia(b) : null}
        textoAnterior={b ? textoPorcentaje(tasaInasistencia(b)) : undefined}
        mejor="baja"
        puntos
      />
      <TarjetaCifra
        titulo="Valor atendido"
        valor={pesos(a.atendido)}
        ayuda="Precio de las citas en que el cliente asistió"
        actual={a.atendido}
        anterior={b?.atendido ?? null}
        textoAnterior={b ? pesos(b.atendido) : undefined}
      />
    </section>
  );
}

function Origen({
  titulo,
  ayuda,
  actual,
  anterior,
}: {
  titulo: string;
  ayuda: string;
  actual: { nombre: string; valor: number }[];
  anterior: { nombre: string; valor: number }[] | null;
}) {
  const totalAntes = anterior?.reduce((s, p) => s + p.valor, 0) ?? 0;
  return (
    <Panel titulo={titulo} ayuda={ayuda}>
      <BarraPartes
        partes={actual.map((p, i) => ({ ...p, color: SERIES[i] }))}
      />
      {anterior ? (
        <p className="mt-3 border-t border-ac-borde pt-3 text-[13px] text-ac-pizarra">
          Antes:{" "}
          {anterior
            .map(
              (p) =>
                `${p.nombre.toLowerCase()} ${textoPorcentaje(porcentaje(p.valor, totalAntes))}`,
            )
            .join(" · ")}
        </p>
      ) : null}
    </Panel>
  );
}

/** General: cifras, mapa de calor por día y hora, estados y origen. */
export function VistaGeneral({ datos }: { datos: Datos }) {
  const { actual: a, anterior: b } = datos;
  const origen = (r: EstadisticasReservas) => [
    { nombre: "En línea", valor: r.porOrigen.enLinea },
    { nombre: "Desde la agenda", valor: r.porOrigen.agenda },
  ];
  return (
    <div className="space-y-4">
      <Tarjetas {...datos} />
      <Panel
        titulo="Reservas por día y hora"
        ayuda="Dónde se concentran las reservas: más oscuro, más reservas"
      >
        <MapaHoras celdas={a.porHora} />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          titulo="Estado de las reservas"
          ayuda="Todas las reservas del período, también las canceladas"
        >
          <ListaBarras
            filas={ORDEN_ESTADOS.map((e) => ({
              nombre: ESTADOS[e].nombre,
              valor: a.porEstado[e] ?? 0,
              anterior: b ? (b.porEstado[e] ?? 0) : null,
            }))}
          />
        </Panel>
        <Origen
          titulo="Origen de las reservas"
          ayuda="Reservas en pie, según por dónde entraron"
          actual={origen(a)}
          anterior={b ? origen(b) : null}
        />
      </div>
    </div>
  );
}

/** Historial: reservas y valor atendido día a día, con el período comparado alineado por día. */
export function VistaHistorial({ datos }: { datos: Datos }) {
  const { actual: a, anterior: b } = datos;
  const serie = (clave: "reservas" | "atendido"): Punto[] =>
    a.porFecha.map((f, i) => ({
      etiqueta: corta(f.fecha),
      actual: f[clave],
      anterior: b?.porFecha[i]?.[clave] ?? null,
      etiquetaAnterior: b?.porFecha[i] ? corta(b.porFecha[i].fecha) : undefined,
    }));
  return (
    <div className="space-y-4">
      <Panel
        titulo="Reservas por día"
        ayuda="Reservas en pie de cada día del período"
      >
        <Linea datos={serie("reservas")} />
      </Panel>
      <Panel
        titulo="Valor atendido por día"
        ayuda="Precio de las citas en que el cliente asistió"
      >
        <Linea datos={serie("atendido")} formato="pesos" />
        <VerDatos
          columnas={["Fecha", "Reservas", "Valor atendido"]}
          filas={a.porFecha.map((f) => [
            corta(f.fecha),
            f.reservas,
            pesos(f.atendido),
          ])}
        />
      </Panel>
    </div>
  );
}

function TablaProfesionales({
  filas,
}: {
  filas: EstadisticasReservas["profesionales"];
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-[13px] text-ac-pizarra">
          <tr className="border-b border-ac-borde">
            <th scope="col" className="py-2 pr-3 font-semibold">
              Profesional
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              Reservas
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              Asistió
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              No asistió
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              Canceladas
            </th>
            <th scope="col" className="w-40 px-3 py-2 font-semibold">
              Ocupación
            </th>
            <th scope="col" className="py-2 pl-3 text-right font-semibold">
              Valor atendido
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((p) => (
            <tr key={p.id} className="border-b border-ac-borde last:border-0">
              <td className="py-2.5 pr-3">
                <span className="flex items-center gap-2 font-medium">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: p.color ?? "#0E7490" }}
                    aria-hidden="true"
                  />
                  {p.nombre}
                </span>
              </td>
              <td className="cifras px-3 text-right">{p.reservas}</td>
              <td className="cifras px-3 text-right">{p.asistencias}</td>
              <td className="cifras px-3 text-right">{p.inasistencias}</td>
              <td className="cifras px-3 text-right">{p.canceladas}</td>
              <td className="px-3">
                <span className="flex items-center gap-2">
                  <span
                    className="h-1.5 flex-1 rounded-full bg-ac-laguna-claro"
                    aria-hidden="true"
                  >
                    <span
                      className="block h-1.5 rounded-full"
                      style={{
                        width: `${Math.min(ocupacion(p), 100)}%`,
                        background: SERIES[0],
                      }}
                    />
                  </span>
                  <span className="cifras w-12 text-right text-xs">
                    {textoPorcentaje(ocupacion(p))}
                  </span>
                </span>
              </td>
              <td className="cifras py-2.5 pl-3 text-right">
                {pesos(p.atendido)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Rendimiento: por profesional, servicios y clientes que más reservaron, y clientes nuevos o de siempre. */
export function VistaRendimiento({ datos }: { datos: Datos }) {
  const { actual: a, anterior: b } = datos;
  const clientes = (r: EstadisticasReservas) => [
    { nombre: "Primera vez", valor: r.clientesPrimeraVez },
    { nombre: "Ya habían venido", valor: r.clientesRecurrentes },
  ];
  return (
    <div className="space-y-4">
      <Panel
        titulo="Rendimiento por profesional"
        ayuda="Reservas, asistencia y ocupación de cada agenda"
      >
        <TablaProfesionales filas={a.profesionales} />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          titulo="Servicios más reservados"
          ayuda="Reservas en pie de cada servicio"
        >
          <ListaBarras
            filas={a.servicios.map((s) => ({
              nombre: s.nombre,
              valor: s.reservas,
            }))}
          />
        </Panel>
        <Panel
          titulo="Clientes que más reservaron"
          ayuda="Con el valor de lo que se les atendió"
        >
          {a.clientes.length === 0 ? (
            <p className="py-6 text-center text-sm text-ac-pizarra">
              Sin reservas en este período.
            </p>
          ) : (
            <ol className="divide-y divide-ac-borde text-sm">
              {a.clientes.map((c, i) => (
                <li key={c.id} className="flex items-center gap-3 py-2">
                  <span className="cifras w-5 text-ac-neblina">{i + 1}</span>
                  <Link
                    href={`/clientes/${c.id}`}
                    className="min-w-0 flex-1 truncate font-medium hover:text-ac-laguna hover:underline"
                  >
                    {c.nombre}
                  </Link>
                  <span className="cifras text-ac-pizarra">
                    {c.reservas} reservas
                  </span>
                  <span className="cifras w-24 text-right font-semibold">
                    {pesos(c.atendido)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
      <Origen
        titulo="Clientes del período"
        ayuda="Clientes con reservas: los que vinieron por primera vez y los que ya habían venido"
        actual={clientes(a)}
        anterior={b ? clientes(b) : null}
      />
    </div>
  );
}
