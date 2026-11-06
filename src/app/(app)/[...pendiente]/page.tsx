import type { Metadata } from "next";
import { buscarRuta } from "@/features/marco/menu";
import { PaginaPendiente as Pendiente } from "@/features/marco/pagina-pendiente";

interface Props {
  params: Promise<{ pendiente: string[] }>;
}

function rutaDe(segmentos: string[]): string {
  return `/${segmentos.map(decodeURIComponent).join("/")}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pendiente } = await params;
  return { title: buscarRuta(rutaDe(pendiente))?.nombre ?? "No encontrada" };
}

/** Secciones del menú que llegan en oleadas futuras; cualquier otra dirección es un 404. */
export default async function PaginaPendiente({ params }: Props) {
  const { pendiente } = await params;
  return <Pendiente ruta={rutaDe(pendiente)} />;
}
