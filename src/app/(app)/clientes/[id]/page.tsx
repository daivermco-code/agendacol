import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { exigirPermiso } from "@/features/auth/services/miembro";
import { FichaCliente } from "@/features/clientes/components/ficha-cliente";
import { FichaClientePaginaCelular } from "@/features/clientes/components/ficha-cliente-celular";
import { fichaCliente } from "@/features/clientes/services/clientes";
import {
  programaSellos,
  sellosDeCliente,
} from "@/features/fidelizacion/services/fidelizacion";
import { buscarRuta } from "@/features/marco/menu";
import { PaginaPendiente } from "@/features/marco/pagina-pendiente";

interface Props {
  params: Promise<{ id: string }>;
}

const esId = (id: string) => z.string().uuid().safeParse(id).success;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!esId(id))
    return { title: buscarRuta(`/clientes/${id}`)?.nombre ?? "No encontrada" };
  return { title: "Ficha del cliente" };
}

/** Ficha del cliente; las opciones del menú Clientes que aún no existen (/clientes/crece) siguen como próxima oleada. */
export default async function PaginaFichaCliente({ params }: Props) {
  const { id } = await params;
  if (!esId(id))
    return <PaginaPendiente ruta={`/clientes/${decodeURIComponent(id)}`} />;
  await exigirPermiso("ver_clientes");
  const [ficha, programa, cuenta] = await Promise.all([
    fichaCliente(id),
    programaSellos(),
    sellosDeCliente(id),
  ]);
  if (!ficha) notFound();
  const hoy = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
  }).format(new Date());
  const sellos = { programa, ...cuenta };
  return (
    <>
      <FichaClientePaginaCelular ficha={ficha} hoy={hoy} sellos={sellos} />
      <div className="hidden md:block">
        <FichaCliente ficha={ficha} hoy={hoy} sellos={sellos} />
      </div>
    </>
  );
}
