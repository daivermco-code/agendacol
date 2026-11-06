import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CabeceraNegocio } from "@/features/reserva-publica/components/cabecera-negocio";
import { CatalogoServicios } from "@/features/reserva-publica/components/catalogo-servicios";
import { PortadaNegocio } from "@/features/reserva-publica/components/portada-negocio";
import { hoyEn } from "@/features/reserva-publica/lib/fechas-publicas";
import { leerLineas } from "@/features/reserva-publica/lib/seleccion";
import { obtenerPortada } from "@/features/reserva-publica/services/publico";
import { deISO } from "@/features/agenda/lib/fechas";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ s?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const portada = await obtenerPortada((await params).slug);
  return {
    title: portada
      ? `Reservar en ${portada.negocio.nombre}`
      : "Negocio no encontrado",
  };
}

export default async function PortadaReservas({ params, searchParams }: Props) {
  const portada = await obtenerPortada((await params).slug);
  if (!portada) notFound();
  const { s } = await searchParams;
  const hoyIso = ((deISO(hoyEn(portada.local.zona)).getDay() + 6) % 7) + 1;

  return (
    <>
      <CabeceraNegocio
        nombre={portada.negocio.nombre}
        logo={portada.negocio.logo}
        slug={portada.negocio.slug}
      />
      <main className="flex-1">
        <PortadaNegocio portada={portada} hoyIso={hoyIso} />
        <CatalogoServicios
          portada={portada}
          inicial={leerLineas(s, portada.servicios)}
        />
      </main>
    </>
  );
}
