import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CabeceraNegocio } from "@/features/reserva-publica/components/cabecera-negocio";
import { FormularioDatos } from "@/features/reserva-publica/components/formulario-datos";
import { PoliticaNegocio } from "@/features/reserva-publica/components/politica-negocio";
import { Pasos } from "@/features/reserva-publica/components/pasos";
import { ResumenReserva } from "@/features/reserva-publica/components/resumen-reserva";
import {
  enlacePaso,
  leerSeleccion,
} from "@/features/reserva-publica/lib/seleccion";
import { obtenerPortada } from "@/features/reserva-publica/services/publico";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ s?: string; p?: string; f?: string; h?: string }>;
}

export const metadata: Metadata = { title: "Tus datos" };

export default async function PasoDatos({ params, searchParams }: Props) {
  const portada = await obtenerPortada((await params).slug);
  if (!portada) notFound();
  const slug = portada.negocio.slug;
  const seleccion = leerSeleccion(await searchParams, portada.servicios);
  if (!seleccion.lineas.length) redirect(enlacePaso(slug, "", seleccion));
  if (!seleccion.fecha || !seleccion.hora)
    redirect(enlacePaso(slug, "hora", seleccion));
  const profesional =
    portada.profesionales.find((p) => p.id === seleccion.profesionalId)
      ?.nombre ?? null;

  return (
    <>
      <CabeceraNegocio
        nombre={portada.negocio.nombre}
        logo={portada.negocio.logo}
        slug={slug}
        volver={{
          href: enlacePaso(slug, "hora", seleccion),
          texto: "Fecha y hora",
        }}
      />
      {/* En celular: pasos y título, resumen, formulario. En computador el resumen va a la derecha. */}
      <main className="mx-auto grid w-full max-w-5xl flex-1 content-start gap-x-6 gap-y-4 px-4 py-6 lg:grid-cols-[1fr_340px]">
        <header className="min-w-0">
          <Pasos actual={3} />
          <h1 className="mb-1 text-xl font-bold">Tus datos</h1>
          <p className="text-ac-pizarra">
            Te enviaremos la confirmación y un enlace para ver, cambiar o
            cancelar tu cita.
          </p>
        </header>
        <aside className="lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <ResumenReserva
            portada={portada}
            lineas={seleccion.lineas}
            profesional={profesional}
            fecha={seleccion.fecha}
            hora={seleccion.hora}
          />
        </aside>
        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <FormularioDatos slug={slug} seleccion={seleccion} />
          <div className="mt-6">
            <PoliticaNegocio reglas={portada.reglas} />
          </div>
        </div>
      </main>
    </>
  );
}
