import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { AccionesCitaPublica } from "@/features/reserva-publica/components/acciones-cita-publica";
import { CabeceraNegocio } from "@/features/reserva-publica/components/cabecera-negocio";
import { CalificarCita } from "@/features/reserva-publica/components/calificar-cita";
import { DetalleCitaPublica } from "@/features/reserva-publica/components/detalle-cita-publica";
import { ListaCitasCliente } from "@/features/reserva-publica/components/lista-citas-cliente";
import { ReservaLista } from "@/features/reserva-publica/components/reserva-lista";
import { hoyEn } from "@/features/reserva-publica/lib/fechas-publicas";
import { obtenerCita } from "@/features/reserva-publica/services/publico";
import { Button } from "@/shared/ui/button";

interface Props {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ nueva?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cita = await obtenerCita((await params).token);
  return {
    title: cita ? `Tu cita en ${cita.negocio.nombre}` : "Cita no encontrada",
    referrer: "no-referrer",
  };
}

/** Enlace personal del cliente (sin cuenta): su cita, qué puede hacer con ella y sus próximas citas. */
export default async function CitaDelCliente({ params, searchParams }: Props) {
  const cita = await obtenerCita((await params).token);
  if (!cita) notFound();
  const { nueva } = await searchParams;
  const hoy = hoyEn(cita.local.zona);

  return (
    <>
      <CabeceraNegocio
        nombre={cita.negocio.nombre}
        logo={cita.negocio.logo}
        slug={cita.negocio.slug}
      />
      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-5 px-4 py-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          {nueva === "1" && cita.estado !== "cancelado" ? (
            <ReservaLista cliente={cita.cliente} token={cita.token} />
          ) : null}
          {nueva !== "1" ? (
            <p className="text-ac-pizarra">
              Hola, {cita.cliente}. Esta es tu cita:
            </p>
          ) : null}
          <DetalleCitaPublica cita={cita} />
          <CalificarCita cita={cita} />
          <AccionesCitaPublica cita={cita} hoy={hoy} />
        </div>

        <aside className="space-y-4 lg:self-start">
          {cita.proximas.length ? (
            <section className="rounded-lg border border-ac-borde bg-ac-papel p-4">
              <h2 className="font-semibold">Tus próximas citas</h2>
              <div className="mt-2">
                <ListaCitasCliente citas={cita.proximas} />
              </div>
            </section>
          ) : null}
          <Button asChild variant="outline" className="w-full">
            <Link href={`/reservar/${cita.negocio.slug}`}>
              <Plus aria-hidden="true" />
              Agendar otra cita
            </Link>
          </Button>
        </aside>
      </main>
    </>
  );
}
