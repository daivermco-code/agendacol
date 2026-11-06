"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, Hourglass, X } from "lucide-react";
import { toast } from "sonner";
import { fechaLarga } from "@/features/reserva-publica/lib/fechas-publicas";
import { Vacio } from "@/shared/components/vacio";
import { telefono } from "@/shared/lib/formato";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { quitarDeEspera } from "../actions";
import { FRANJAS } from "../lib/franjas";
import type { FilaEspera } from "../types";

const DIA_AVISO = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  day: "numeric",
  month: "short",
});
const HORA_AVISO = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  hour: "numeric",
  minute: "2-digit",
});

function Estado({ f, hoy }: { f: FilaEspera; hoy: string }) {
  if (f.estado === "quitado")
    return <Insignia clase="bg-ac-niebla text-ac-pizarra">Quitado</Insignia>;
  if (f.estado === "avisado")
    return (
      <Insignia clase="bg-ac-exito-fondo text-ac-exito">
        <BellRing className="h-3 w-3" aria-hidden="true" />
        <span>
          Avisado
          {f.avisadoAt ? (
            <>
              {" "}
              {DIA_AVISO.format(new Date(f.avisadoAt))}
              <span className="hidden lg:inline">
                , {HORA_AVISO.format(new Date(f.avisadoAt))}
              </span>
            </>
          ) : null}
        </span>
      </Insignia>
    );
  if (f.fecha < hoy)
    return <Insignia clase="bg-ac-niebla text-ac-pizarra">Venció</Insignia>;
  return <Insignia clase="bg-ac-aviso-fondo text-ac-aviso">Esperando</Insignia>;
}

function Insignia({
  clase,
  children,
}: {
  clase: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium",
        clase,
      )}
    >
      {children}
    </span>
  );
}

function BotonQuitar({ f }: { f: FilaEspera }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransicionRed();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={ocupado}
      aria-label={`Quitar a ${f.cliente} de la lista de espera`}
      onClick={() =>
        iniciar(async () => {
          const r = await quitarDeEspera(f.id);
          if (!r.ok) toast.error(r.error);
          else {
            toast.success(`${f.cliente} salió de la lista de espera`);
            router.refresh();
          }
        })
      }
    >
      <X aria-hidden="true" />
      Quitar
    </Button>
  );
}

/** Quién espera que se libere una hora: vigentes (de hoy en adelante) o todas. */
export function ListaEsperaVista({
  filas,
  hoy,
  puedeQuitar,
}: {
  filas: FilaEspera[];
  hoy: string;
  puedeQuitar: boolean;
}) {
  const [todas, setTodas] = useState(false);
  const vigentes = filas.filter(
    (f) => f.fecha >= hoy && f.estado !== "quitado",
  );
  const vistas = todas ? filas : vigentes;

  return (
    <div className="space-y-3">
      <div className="flex gap-2" role="tablist" aria-label="Qué mostrar">
        {[
          { valor: false, texto: `Vigentes (${vigentes.length})` },
          { valor: true, texto: `Todas (${filas.length})` },
        ].map((o) => (
          <button
            key={o.texto}
            type="button"
            role="tab"
            aria-selected={todas === o.valor}
            onClick={() => setTodas(o.valor)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium min-h-11 md:min-h-0",
              todas === o.valor
                ? "border-ac-laguna bg-ac-laguna-claro text-ac-laguna-hondo"
                : "border-ac-borde bg-ac-papel hover:border-ac-laguna",
            )}
          >
            {o.texto}
          </button>
        ))}
      </div>

      {vistas.length === 0 ? (
        <Vacio
          icono={Hourglass}
          titulo="Nadie está esperando"
          texto="Cuando un cliente pida en el sitio de reservas que le avisemos si se libera una hora, aparece aquí."
        />
      ) : (
        <ul className="divide-y divide-ac-borde rounded-lg border border-ac-borde bg-ac-papel">
          {vistas.map((f) => (
            <li
              key={f.id}
              className="grid gap-x-4 gap-y-1 px-4 py-3 md:grid-cols-[10.5rem_minmax(0,1fr)_minmax(0,1fr)_13rem] md:items-center lg:grid-cols-[13rem_minmax(0,1fr)_minmax(0,1fr)_17rem]"
            >
              <div>
                <p className="font-medium">{fechaLarga(f.fecha)}</p>
                <p className="text-sm text-ac-pizarra">{FRANJAS[f.franja]}</p>
              </div>
              <div className="min-w-0">
                <Link
                  href={`/clientes/${f.clienteId}`}
                  className="area-tactil font-medium text-ac-laguna hover:underline"
                >
                  {f.cliente}
                </Link>
                <p className="whitespace-nowrap text-sm text-ac-pizarra">
                  {f.telefono ? telefono(f.telefono) : "—"}
                </p>
              </div>
              <div className="min-w-0">
                <p className="truncate">{f.servicios}</p>
                <p className="text-sm text-ac-pizarra">
                  {f.profesional ? `Con ${f.profesional}` : "Con cualquiera"}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 md:justify-end">
                <Estado f={f} hoy={hoy} />
                {puedeQuitar && f.estado !== "quitado" && f.fecha >= hoy ? (
                  <BotonQuitar f={f} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
