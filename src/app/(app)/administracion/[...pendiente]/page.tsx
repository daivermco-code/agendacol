import { notFound } from "next/navigation";
import { buscarRuta } from "@/features/marco/menu";
import { ProximaOleada } from "@/shared/components/proxima-oleada";

export default async function AdministracionPendiente({ params }: { params: Promise<{ pendiente: string[] }> }) {
  const { pendiente } = await params;
  const opcion = buscarRuta(`/administracion/${pendiente.join("/")}`);
  if (!opcion) notFound();
  return <ProximaOleada titulo={opcion.nombre} resumen={opcion.resumen} />;
}
