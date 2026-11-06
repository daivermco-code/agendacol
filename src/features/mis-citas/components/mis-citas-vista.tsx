import type { ReactNode } from "react";
import Link from "next/link";
import { BellRing, Plus } from "lucide-react";
import { FRANJAS } from "@/features/lista-espera/lib/franjas";
import { ListaCitasCliente } from "@/features/reserva-publica/components/lista-citas-cliente";
import { fechaLarga } from "@/features/reserva-publica/lib/fechas-publicas";
import { Button } from "@/shared/ui/button";
import type { EsperaCliente, MisCitas } from "../types";
import { BotonQuitarEspera, BotonSalir } from "./botones-mis-citas";

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-ac-borde bg-ac-papel p-4">
      <h2 className="font-semibold">{titulo}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Espera({ e }: { e: EsperaCliente }) {
  const descripcion = `${e.servicios} el ${fechaLarga(e.fecha).toLowerCase()}`;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{e.servicios}</p>
        <p className="text-sm text-ac-pizarra">
          {fechaLarga(e.fecha)} · {FRANJAS[e.franja]}
          {e.profesional ? ` · con ${e.profesional}` : ""}
        </p>
        {e.estado === "avisado" ? (
          <p className="mt-1 inline-flex items-center gap-1 rounded bg-ac-exito-fondo px-1.5 py-0.5 text-xs font-medium text-ac-exito">
            <BellRing className="h-3 w-3" aria-hidden="true" />
            Se liberó una hora
          </p>
        ) : (
          <p className="mt-1 inline-flex rounded bg-ac-niebla px-1.5 py-0.5 text-xs font-medium text-ac-pizarra">
            Esperando
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">
        {e.estado === "avisado" ? (
          <Button asChild size="sm">
            <Link href={e.enlace}>Ver horas</Link>
          </Button>
        ) : null}
        <BotonQuitarEspera id={e.id} descripcion={descripcion} />
      </div>
    </li>
  );
}

/** "Mis citas": próximas, listas de espera e historial, cada cita con su enlace para confirmar, cambiar o cancelar. */
export function MisCitasVista({ mis }: { mis: MisCitas }) {
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">
            {mis.cliente ? `Hola, ${mis.cliente}` : "Mis citas"}
          </h1>
          <p className="text-sm text-ac-pizarra">
            Entraste con {mis.destino}. El acceso dura 7 días en este navegador.
          </p>
        </div>
        <BotonSalir />
      </header>

      <Seccion titulo="Próximas citas">
        {mis.proximas.length ? (
          <ListaCitasCliente citas={mis.proximas} />
        ) : (
          <p className="py-2 text-sm text-ac-pizarra">
            No tienes citas próximas.
          </p>
        )}
        <Button asChild variant="outline" className="mt-3 w-full sm:w-auto">
          <Link href={`/reservar/${mis.negocio.slug}`}>
            <Plus aria-hidden="true" />
            Agendar una cita
          </Link>
        </Button>
      </Seccion>

      {mis.esperas.length ? (
        <Seccion titulo="Lista de espera">
          <p className="text-sm text-ac-pizarra">
            Te avisamos por correo y WhatsApp si se libera una hora.
          </p>
          <ul className="divide-y divide-ac-borde">
            {mis.esperas.map((e) => (
              <Espera key={e.id} e={e} />
            ))}
          </ul>
        </Seccion>
      ) : null}

      {mis.historial.length ? (
        <Seccion titulo="Historial">
          <ListaCitasCliente citas={mis.historial} />
        </Seccion>
      ) : null}
    </div>
  );
}
