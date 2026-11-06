import { notFound, redirect } from "next/navigation";
import { obtenerMiembro } from "@/features/auth/services/miembro";
import { ProximaOleada } from "@/shared/components/proxima-oleada";
import { puedeVerRuta } from "@/shared/lib/permisos";
import { buscarRuta } from "./menu";

/** Sección del menú que llega en una oleada futura; cualquier otra dirección es un 404. */
export async function PaginaPendiente({ ruta }: { ruta: string }) {
  const opcion = buscarRuta(ruta);
  if (!opcion) notFound();

  const miembro = await obtenerMiembro();
  if (!miembro) redirect("/entrar");
  if (!puedeVerRuta(miembro.rol, ruta)) redirect("/agenda?aviso=sin-permiso");

  return <ProximaOleada titulo={opcion.nombre} resumen={opcion.resumen} />;
}
