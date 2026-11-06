import { ExternalLink, TriangleAlert } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import type { Database } from "@/types/database";
import { ResponderAviso } from "./responder-aviso";

type Aviso = Database["public"]["Tables"]["avisos_demo"]["Row"];

const EXPLICACION: Record<string, string> = {
  sin_contacto:
    "No se habría enviado: falta el correo o el teléfono del cliente.",
  omitido:
    "No se envió: la cita ya estaba confirmada o la hora de envío ya había pasado.",
  programado: "Saldría a la hora indicada.",
};

interface Respuesta {
  id: string;
  cuerpo: string;
  fecha: string;
}

/** Un mensaje del chat. Lo que escribe el cliente va a la izquierda, como en el WhatsApp del negocio. */
function Burbuja({
  cuerpo,
  fecha,
  entrante,
}: {
  cuerpo: string;
  fecha: string;
  entrante: boolean;
}) {
  return (
    <div
      className={cn(
        "max-w-[420px] rounded-lg px-3.5 py-2.5 shadow-quieta",
        entrante
          ? "mr-auto rounded-tl-sm bg-ac-papel"
          : "ml-auto rounded-tr-sm bg-[#D7F4D2] dark:bg-[#1E3D27]",
      )}
    >
      <p className="whitespace-pre-line text-[15px] leading-relaxed">
        {cuerpo}
      </p>
      <p className="mt-1 text-right text-[11px] text-ac-pizarra">{fecha}</p>
    </div>
  );
}

/** Un aviso con aspecto de correo o de chat de WhatsApp, y lo que la demo deja hacer como cliente. */
export function DetalleAviso({
  aviso,
  tipo,
  fecha,
  respuestas,
  puedeResponder,
}: {
  aviso: Aviso;
  tipo: string;
  fecha: string;
  /** Lo que el cliente contestó a este WhatsApp. */
  respuestas: Respuesta[];
  /** WhatsApp de confirmación o recordatorio cuya cita sigue esperando respuesta. */
  puedeResponder: boolean;
}) {
  const explicacion = EXPLICACION[aviso.estado];

  return (
    <article className="rounded-lg border border-ac-borde bg-ac-papel shadow-quieta">
      {explicacion ? (
        <p className="flex items-center gap-2 border-b border-ac-borde bg-ac-aviso-fondo px-5 py-2.5 text-sm text-ac-demo-texto">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />{" "}
          {explicacion}
        </p>
      ) : null}
      {aviso.canal === "correo" ? (
        <div className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ac-neblina">
            {tipo}
          </p>
          <h2 className="mt-1 text-lg font-bold">{aviso.asunto ?? tipo}</h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-ac-borde pb-3 text-sm">
            <dt className="text-ac-pizarra">Para</dt>
            <dd>
              {aviso.destinatario}{" "}
              {aviso.destino ? (
                <span className="text-ac-pizarra">&lt;{aviso.destino}&gt;</span>
              ) : (
                <span className="text-ac-aviso">sin correo</span>
              )}
            </dd>
            <dt className="text-ac-pizarra">Fecha</dt>
            <dd>{fecha}</dd>
          </dl>
          <div className="mt-4 whitespace-pre-line leading-relaxed">
            {aviso.cuerpo}
          </div>
        </div>
      ) : (
        <div className="p-5">
          <p className="text-sm">
            <span className="font-semibold">{aviso.destinatario}</span>{" "}
            <span className="text-ac-pizarra">
              {aviso.destino ?? "sin teléfono"}
            </span>
          </p>
          <div className="mt-3 space-y-2 rounded-lg bg-[#E8F3EE] dark:bg-[#18302A] p-4">
            <Burbuja
              cuerpo={aviso.cuerpo}
              fecha={fecha}
              entrante={aviso.tipo === "respuesta"}
            />
            {respuestas.map((r) => (
              <Burbuja key={r.id} cuerpo={r.cuerpo} fecha={r.fecha} entrante />
            ))}
          </div>
        </div>
      )}
      {aviso.enlace || puedeResponder ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-ac-borde bg-ac-niebla px-5 py-3">
          <p className="mr-auto text-sm text-ac-pizarra">Haz de cliente:</p>
          {aviso.enlace ? (
            <Button variant="outline" size="sm" asChild>
              <a href={aviso.enlace} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" />
                Abrir como cliente
              </a>
            </Button>
          ) : null}
          {puedeResponder ? <ResponderAviso avisoId={aviso.id} /> : null}
        </div>
      ) : null}
    </article>
  );
}
