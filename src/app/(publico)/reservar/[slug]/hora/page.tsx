import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CabeceraNegocio } from "@/features/reserva-publica/components/cabecera-negocio";
import { PasoHora } from "@/features/reserva-publica/components/paso-hora";
import {
  hoyEn,
  inicioTira,
} from "@/features/reserva-publica/lib/fechas-publicas";
import {
  enlacePaso,
  expandir,
  leerSeleccion,
  profesionalesPara,
} from "@/features/reserva-publica/lib/seleccion";
import {
  obtenerDias,
  obtenerPortada,
} from "@/features/reserva-publica/services/publico";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ s?: string; p?: string; f?: string; h?: string }>;
}

export const metadata: Metadata = { title: "Elige fecha y hora" };

export default async function PasoFechaHora({ params, searchParams }: Props) {
  const portada = await obtenerPortada((await params).slug);
  if (!portada) notFound();
  const slug = portada.negocio.slug;
  const seleccion = leerSeleccion(await searchParams, portada.servicios);
  if (!seleccion.lineas.length || !portada.local.recibeReservas)
    redirect(enlacePaso(slug, "", seleccion));

  const candidatos = profesionalesPara(seleccion.lineas, portada.profesionales);
  const profesionalId = candidatos.some((p) => p.id === seleccion.profesionalId)
    ? seleccion.profesionalId
    : null;
  const hoy = hoyEn(portada.local.zona);
  const desde = inicioTira(seleccion.fecha, hoy);
  const dias = candidatos.length
    ? ((await obtenerDias(
        slug,
        expandir(seleccion.lineas),
        profesionalId,
        desde,
      )) ?? [])
    : [];

  return (
    <>
      <CabeceraNegocio
        nombre={portada.negocio.nombre}
        logo={portada.negocio.logo}
        slug={slug}
        volver={{ href: enlacePaso(slug, "", seleccion), texto: "Servicios" }}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <PasoHora
          portada={portada}
          seleccion={{ ...seleccion, profesionalId }}
          candidatos={candidatos}
          hoy={hoy}
          desdeInicial={desde}
          diasIniciales={dias}
        />
      </main>
    </>
  );
}
