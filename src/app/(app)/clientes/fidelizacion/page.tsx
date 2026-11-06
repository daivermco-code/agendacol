import type { Metadata } from "next";
import { exigirPermiso } from "@/features/auth/services/miembro";
import { FidelizacionVista } from "@/features/fidelizacion/components/fidelizacion-vista";
import {
  listarTarjetas,
  panelSellos,
  programaSellos,
} from "@/features/fidelizacion/services/fidelizacion";
import { puede } from "@/shared/lib/permisos";

export const metadata: Metadata = { title: "Fidelización" };

export default async function PaginaFidelizacion() {
  const miembro = await exigirPermiso("ver_marketing");
  const programa = await programaSellos();
  const tarjetas = await listarTarjetas(programa.meta);
  const panel = await panelSellos(tarjetas, programa.meta);
  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-4 lg:px-6 lg:py-6">
      <header>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-2xl">
          Fidelización
        </h1>
        <p className="text-ac-pizarra">
          Tarjeta digital de sellos: un sello por visita y un premio al
          llenarla.
        </p>
      </header>
      <FidelizacionVista
        programa={programa}
        tarjetas={tarjetas}
        panel={panel}
        puedeConfigurar={puede(miembro.rol, "editar_ajustes")}
      />
    </main>
  );
}
