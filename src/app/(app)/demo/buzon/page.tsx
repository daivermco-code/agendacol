import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Inbox, Mail, MessageCircle, X } from "lucide-react";
import { exigirPermiso } from "@/features/auth/services/miembro";
import { DetalleAviso } from "@/features/demo/components/detalle-aviso";
import { Vacio } from "@/shared/components/vacio";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import { cn } from "@/shared/lib/utils";
import type { Database } from "@/types/database";

export const metadata: Metadata = { title: "Buzón de la demo" };

const TIPOS: Record<string, string> = {
  confirmacion: "Reserva creada",
  recordatorio: "Recordatorio",
  cambio: "Cambio de cita",
  cancelacion: "Cancelación",
  comprobante: "Comprobante",
  link_pago: "Enlace de pago",
  invitacion: "Invitación",
  enlace: "Enlace de reservas",
  respuesta: "Respuesta del cliente",
  calificacion: "Califica tu atención",
  campana: "Campaña de correo",
  sellos: "Tarjeta de sellos",
  plantilla: "Mensaje de WhatsApp",
  equipo: "Aviso al equipo",
  codigo: "Código de acceso",
  espera: "Lista de espera",
};
const ESTADOS: Record<string, { nombre: string; clase: string }> = {
  enviado: { nombre: "Enviado", clase: "bg-ac-exito-fondo text-ac-exito" },
  recibido: {
    nombre: "Recibido",
    clase: "bg-ac-laguna-claro text-ac-laguna-hondo",
  },
  programado: { nombre: "Programado", clase: "bg-ac-info-fondo text-ac-info" },
  sin_contacto: {
    nombre: "Sin contacto",
    clase: "bg-ac-aviso-fondo text-ac-aviso",
  },
  omitido: { nombre: "Omitido", clase: "bg-ac-niebla-oscura text-ac-pizarra" },
};

interface Props {
  searchParams: Promise<{
    canal?: string;
    estado?: string;
    id?: string;
    campana?: string;
  }>;
}

function enlace(
  base: Record<string, string | undefined>,
  cambio: Record<string, string | undefined>,
) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...cambio }))
    if (v) p.set(k, v);
  const q = p.toString();
  return q ? `/demo/buzon?${q}` : "/demo/buzon";
}

const FECHA = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  dateStyle: "medium",
  timeStyle: "short",
});

type Aviso = Database["public"]["Tables"]["avisos_demo"]["Row"];
const SIN_CONVERSACION = { puedeResponder: false, respuestas: [] as Aviso[] };

/**
 * Al WhatsApp enviado de confirmación o recordatorio se le puede responder mientras la cita espera
 * confirmación; si el cliente ya respondió, su respuesta se ve debajo, en el mismo chat.
 */
async function conversacion(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  aviso: Aviso,
) {
  if (
    !aviso.cita_id ||
    aviso.canal !== "whatsapp" ||
    aviso.estado !== "enviado" ||
    (aviso.tipo !== "confirmacion" && aviso.tipo !== "recordatorio")
  )
    return SIN_CONVERSACION;
  const [{ data: cita }, { data: respuestas }] = await Promise.all([
    supabase
      .from("citas")
      .select("estado")
      .eq("id", aviso.cita_id)
      .maybeSingle(),
    supabase
      .from("avisos_demo")
      .select("*")
      .eq("cita_id", aviso.cita_id)
      .eq("tipo", "respuesta")
      .gt("programado_para", aviso.programado_para)
      .order("programado_para"),
  ]);
  return {
    puedeResponder: cita?.estado === "reservado",
    respuestas: respuestas ?? [],
  };
}

export default async function Buzon({ searchParams }: Props) {
  await exigirPermiso("ver_buzon");
  const filtros = await searchParams;
  const canal =
    filtros.canal === "correo" || filtros.canal === "whatsapp"
      ? filtros.canal
      : undefined;
  const estado =
    filtros.estado && filtros.estado in ESTADOS ? filtros.estado : undefined;
  const campana = /^[0-9a-f-]{36}$/.test(filtros.campana ?? "")
    ? filtros.campana
    : undefined;

  const supabase = await crearClienteServidor();
  let consulta = supabase
    .from("avisos_demo")
    .select("*")
    .order("created_at", { ascending: false })
    .order("programado_para", { ascending: false })
    .limit(200);
  if (canal) consulta = consulta.eq("canal", canal);
  if (estado) consulta = consulta.eq("estado", estado);
  if (campana) consulta = consulta.eq("campana_id", campana);
  const { data: avisos } = await consulta;
  const lista = avisos ?? [];
  const elegido = lista.find((a) => a.id === filtros.id);
  const base = { canal, estado, campana };

  const { puedeResponder, respuestas } = elegido
    ? await conversacion(supabase, elegido)
    : SIN_CONVERSACION;

  const fichas = [
    {
      nombre: "Todos",
      href: enlace(base, { canal: undefined }),
      activo: !canal,
    },
    {
      nombre: "Correo",
      href: enlace(base, { canal: "correo" }),
      activo: canal === "correo",
    },
    {
      nombre: "WhatsApp",
      href: enlace(base, { canal: "whatsapp" }),
      activo: canal === "whatsapp",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-6">
      <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-2xl">
        Buzón de la demo
      </h1>
      <p className="text-ac-pizarra">
        Aquí llegan los correos, WhatsApp y pagos simulados. Nada sale de tu
        computador.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {fichas.map((f) => (
          <Link
            key={f.nombre}
            href={f.href}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm inline-flex min-h-11 items-center md:inline md:min-h-0",
              f.activo
                ? "border-ac-laguna bg-ac-laguna-claro font-semibold text-ac-laguna-hondo"
                : "border-ac-borde bg-ac-papel hover:bg-ac-niebla",
            )}
          >
            {f.nombre}
          </Link>
        ))}
        <span className="mx-1 h-5 w-px bg-ac-borde" aria-hidden="true" />
        {Object.entries(ESTADOS).map(([clave, e]) => (
          <Link
            key={clave}
            href={enlace(base, {
              estado: estado === clave ? undefined : clave,
            })}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm inline-flex min-h-11 items-center md:inline md:min-h-0",
              estado === clave
                ? "border-ac-laguna bg-ac-laguna-claro font-semibold text-ac-laguna-hondo"
                : "border-ac-borde bg-ac-papel hover:bg-ac-niebla",
            )}
          >
            {e.nombre}
          </Link>
        ))}
        {campana ? (
          <Link
            href={enlace(base, { campana: undefined, id: undefined })}
            className="inline-flex items-center gap-1.5 rounded-full border border-ac-laguna bg-ac-laguna-claro px-3.5 py-1.5 text-sm font-semibold text-ac-laguna-hondo min-h-11 md:min-h-0"
          >
            Una campaña
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">: ver todos los avisos</span>
          </Link>
        ) : null}
      </div>

      {lista.length === 0 ? (
        <div className="mt-4">
          <Vacio
            icono={Inbox}
            titulo="Todavía no hay avisos"
            texto={
              canal || estado || campana
                ? "Ningún aviso cumple los filtros."
                : "Crea una reserva para ver uno aquí."
            }
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
          <ul
            className={cn(
              "overflow-hidden rounded-lg border border-ac-borde bg-ac-papel shadow-quieta",
              elegido && "hidden lg:block",
            )}
          >
            {lista.map((a) => (
              <li
                key={a.id}
                className="border-b border-ac-borde last:border-b-0"
              >
                <Link
                  href={enlace(base, { id: a.id })}
                  className={cn(
                    "flex gap-3 px-4 py-3 hover:bg-ac-niebla",
                    a.id === elegido?.id && "bg-ac-laguna-claro",
                  )}
                >
                  {a.canal === "correo" ? (
                    <Mail
                      className="mt-0.5 h-5 w-5 shrink-0 text-ac-info"
                      aria-label="Correo"
                    />
                  ) : (
                    <MessageCircle
                      className="mt-0.5 h-5 w-5 shrink-0 text-ac-exito"
                      aria-label="WhatsApp"
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">
                        {a.destinatario ?? a.destino ?? "Sin destinatario"}
                      </span>
                      <span className="shrink-0 text-xs text-ac-neblina">
                        {FECHA.format(new Date(a.programado_para))}
                      </span>
                    </span>
                    <span className="block truncate text-sm">
                      {TIPOS[a.tipo] ?? a.tipo}
                    </span>
                    <span
                      className={cn(
                        "mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                        ESTADOS[a.estado]?.clase,
                      )}
                    >
                      {ESTADOS[a.estado]?.nombre}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {elegido ? (
            <div>
              <Link
                href={enlace(base, { id: undefined })}
                className="mb-3 inline-flex min-h-11 items-center gap-1 font-semibold text-ac-laguna md:min-h-0 lg:hidden"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver a la
                lista
              </Link>
              <DetalleAviso
                aviso={elegido}
                tipo={TIPOS[elegido.tipo] ?? elegido.tipo}
                fecha={FECHA.format(new Date(elegido.programado_para))}
                respuestas={respuestas.map((r) => ({
                  id: r.id,
                  cuerpo: r.cuerpo,
                  fecha: FECHA.format(new Date(r.programado_para)),
                }))}
                puedeResponder={puedeResponder}
              />
            </div>
          ) : (
            <div className="hidden items-center justify-center rounded-lg border border-dashed border-ac-borde text-ac-neblina lg:flex">
              Elige un aviso para verlo completo.
            </div>
          )}
        </div>
      )}
    </main>
  );
}
