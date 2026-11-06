import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  BellOff,
  CalendarCheck,
  Info,
  Mail,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { textoPorcentaje } from "@/features/reportes/lib/graficos";
import { porcentaje } from "@/features/reportes/lib/periodos";
import { Vacio } from "@/shared/components/vacio";
import { pesos } from "@/shared/lib/formato";
import type {
  CanalRecordatorios,
  EstadisticasRecordatorios,
  ReservaSinRecordatorio,
} from "../types";

const numero = new Intl.NumberFormat("es-CO");
const diaCorto = (f: string) =>
  format(parseISO(f), "EEE d MMM", { locale: es });

/** Nota que explica cómo confirman los clientes y cuándo no sale un recordatorio. */
export function NotaRecordatorios() {
  return (
    <div className="flex gap-3 rounded-lg border border-ac-info/30 bg-ac-info-fondo p-3 text-sm sm:p-4">
      <Info
        className="mt-0.5 h-4 w-4 shrink-0 text-ac-info"
        aria-hidden="true"
      />
      <p>
        <strong className="font-semibold">
          Tus clientes confirman con el botón de su enlace, que llega por
          correo, o respondiendo «SÍ» al WhatsApp.
        </strong>{" "}
        Aquí ves cuántos recordatorios salieron, cuántas reservas se confirmaron
        por cada camino y cuáles se quedaron sin recordatorio. Si la cita ya
        estaba confirmada, el WhatsApp no sale. Todo llega al buzón de la demo;
        nada se envía de verdad.
      </p>
    </div>
  );
}

/** Franja oscura con los mensajes de WhatsApp del mes: los del plan, los usados y los que quedan. */
export function CupoWhatsapp({
  cupo,
}: {
  cupo: EstadisticasRecordatorios["cupo"];
}) {
  const quedan = Math.max(cupo.contratados - cupo.usados, 0);
  const usado = Math.min(porcentaje(cupo.usados, cupo.contratados), 100);
  return (
    <section
      aria-labelledby="titulo-cupo"
      className="rounded-lg bg-ac-noche p-4 text-ac-sobre-noche sm:p-5"
    >
      <h2 id="titulo-cupo" className="font-semibold">
        Recordatorios de WhatsApp de este mes
      </h2>
      <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:flex sm:flex-wrap">
        {[
          ["Mensajes al mes", numero.format(cupo.contratados)],
          ["Usados", numero.format(cupo.usados)],
          ["Quedan", numero.format(quedan)],
          ["Vencen", format(parseISO(cupo.vence), "d MMM", { locale: es })],
        ].map(([n, v]) => (
          <div key={n} className="flex gap-1.5">
            <dt className="text-ac-sobre-noche-suave">{n}:</dt>
            <dd className="cifras whitespace-nowrap font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-ac-noche-claro"
        role="meter"
        aria-label="Mensajes usados del mes"
        aria-valuemin={0}
        aria-valuemax={cupo.contratados}
        aria-valuenow={cupo.usados}
      >
        <div
          className="h-full rounded-full bg-ac-laguna"
          style={{ width: `${usado}%` }}
        />
      </div>
    </section>
  );
}

/** Una fila con su barra: la barra es la parte sobre `total`; el número va en tinta, al lado. */
function Fila({
  nombre,
  valor,
  total,
}: {
  nombre: string;
  valor: number;
  total: number;
}) {
  return (
    <div className="grid grid-cols-[1fr_minmax(64px,96px)_3rem] items-center gap-3 text-sm">
      <dt className="text-ac-pizarra">{nombre}</dt>
      <dd className="col-span-2 grid grid-cols-[minmax(64px,96px)_3rem] items-center gap-3">
        <span
          aria-hidden="true"
          className="h-1.5 overflow-hidden rounded-full bg-ac-niebla-oscura"
        >
          <span
            className="block h-full rounded-full bg-ac-laguna"
            style={{ width: `${Math.min(porcentaje(valor, total), 100)}%` }}
          />
        </span>
        <span className="cifras text-right font-semibold">
          {numero.format(valor)}
        </span>
      </dd>
    </div>
  );
}

function Tarjeta({
  icono: Icono,
  titulo,
  ingresos,
  confirmadas,
  reservas,
  filas,
  nota,
}: {
  icono: LucideIcon;
  titulo: string;
  ingresos: number;
  confirmadas: number;
  reservas: number;
  filas: { nombre: string; valor: number; total: number }[];
  nota: string;
}) {
  return (
    <section
      aria-label={titulo}
      className="flex min-w-0 flex-col rounded-lg border border-ac-borde bg-ac-papel p-4 shadow-quieta"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="cifras text-2xl font-bold tracking-tight">
            {pesos(ingresos)}
          </p>
          <h2 className="text-sm text-ac-pizarra">{titulo}</h2>
        </div>
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ac-laguna-claro text-ac-laguna-hondo">
          <Icono className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 border-t border-ac-borde pt-3 text-sm font-semibold">
        {textoPorcentaje(porcentaje(confirmadas, reservas))} de las reservas
        confirmadas
      </p>
      <dl className="mt-3 space-y-2.5">
        {filas.map((f) => (
          <Fila key={f.nombre} {...f} />
        ))}
      </dl>
      <p className="mt-auto pt-4 text-xs text-ac-pizarra">{nota}</p>
    </section>
  );
}

function filasCanal(c: CanalRecordatorios, reservas: number, quien: string) {
  return [
    { nombre: `${quien} enviados`, valor: c.enviados, total: reservas },
    { nombre: "Confirmaron", valor: c.confirmadas, total: reservas },
    { nombre: "No salieron", valor: c.noEnviados, total: reservas },
  ];
}

/** Las tres tarjetas: todas las confirmaciones, las del correo y las del WhatsApp. */
export function TarjetasRecordatorios({
  datos,
}: {
  datos: EstadisticasRecordatorios;
}) {
  const { correo, whatsapp } = datos.canales;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <Tarjeta
        icono={CalendarCheck}
        titulo="Ingresos de reservas confirmadas (equipo, correo y WhatsApp)"
        ingresos={datos.ingresosConfirmados}
        confirmadas={datos.confirmadas}
        reservas={datos.reservas}
        filas={[
          { nombre: "Reservas", valor: datos.reservas, total: datos.reservas },
          {
            nombre: "Confirmadas",
            valor: datos.confirmadas,
            total: datos.reservas,
          },
          {
            nombre: "Asistieron",
            valor: datos.asistidas,
            total: datos.reservas,
          },
        ]}
        nota={`El equipo confirmó ${numero.format(datos.porEquipo)} a mano desde la agenda. Si el cliente no tiene correo ni teléfono, el recordatorio no se programa.`}
      />
      <Tarjeta
        icono={Mail}
        titulo="Ingresos confirmados por correo"
        ingresos={correo.ingresos}
        confirmadas={correo.confirmadas}
        reservas={datos.reservas}
        filas={filasCanal(correo, datos.reservas, "Correos")}
        nota={`No sale si el cliente no tiene correo, si se apagaron los avisos de la cita o si se agendó después de la hora de envío.${correo.programados ? ` Quedan ${numero.format(correo.programados)} programados.` : ""}`}
      />
      <Tarjeta
        icono={MessageCircle}
        titulo="Ingresos confirmados por WhatsApp"
        ingresos={whatsapp.ingresos}
        confirmadas={whatsapp.confirmadas}
        reservas={datos.reservas}
        filas={filasCanal(whatsapp, datos.reservas, "WhatsApp")}
        nota={`No sale si el cliente no tiene teléfono, si la cita ya estaba confirmada o si se agendó después de la hora de envío.${whatsapp.programados ? ` Quedan ${numero.format(whatsapp.programados)} programados.` : ""}`}
      />
    </div>
  );
}

/** Reservas del período que no recibieron ningún recordatorio, con el motivo. */
export function ReservasSinRecordatorio({
  total,
  filas,
}: {
  total: number;
  filas: ReservaSinRecordatorio[];
}) {
  return (
    <section aria-labelledby="titulo-sin" className="space-y-3">
      <h2 id="titulo-sin" className="text-lg font-semibold">
        Reservas sin recordatorio{" "}
        <span className="cifras font-normal text-ac-pizarra">({total})</span>
      </h2>
      {filas.length === 0 ? (
        <Vacio
          icono={BellOff}
          titulo="Todas las reservas tuvieron su recordatorio"
          texto="En este período no hay reservas que se quedaran sin aviso."
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-ac-borde bg-ac-papel md:block">
            <table className="w-full text-sm">
              <thead className="bg-ac-niebla text-left text-ac-pizarra">
                <tr>
                  {[
                    "Fecha",
                    "Cliente",
                    "Servicio",
                    "Profesional",
                    "Motivo",
                  ].map((t) => (
                    <th key={t} scope="col" className="px-3 py-2 font-medium">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((r) => (
                  <tr key={r.id} className="border-t border-ac-borde">
                    <td className="cifras whitespace-nowrap px-3 py-2 first-letter:uppercase">
                      {diaCorto(r.fecha)} · {r.hora}
                    </td>
                    <td className="px-3 py-2 font-medium">{r.cliente}</td>
                    <td className="px-3 py-2">{r.servicio}</td>
                    <td className="px-3 py-2">{r.profesional}</td>
                    <td className="px-3 py-2 text-ac-pizarra">{r.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2 md:hidden">
            {filas.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-ac-borde bg-ac-papel p-3 text-sm"
              >
                <p className="font-medium">{r.cliente}</p>
                <p className="cifras text-ac-pizarra first-letter:uppercase">
                  {diaCorto(r.fecha)} · {r.hora} · {r.servicio} con{" "}
                  {r.profesional}
                </p>
                <p className="mt-1 text-xs text-ac-pizarra">{r.motivo}</p>
              </li>
            ))}
          </ul>
          {total > filas.length ? (
            <p className="text-xs text-ac-pizarra">
              Se muestran las {filas.length} más recientes de {total}.
            </p>
          ) : null}
        </>
      )}
      <p className="text-sm">
        <Link
          href="/ajustes/recordatorios"
          className="area-tactil font-medium text-ac-laguna-hondo underline underline-offset-2"
        >
          Configurar los recordatorios
        </Link>
      </p>
    </section>
  );
}
