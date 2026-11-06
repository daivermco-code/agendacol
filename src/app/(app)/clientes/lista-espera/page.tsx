import type { Metadata } from "next";
import { exigirPermiso } from "@/features/auth/services/miembro";
import { ListaEsperaVista } from "@/features/lista-espera/components/lista-espera-vista";
import { listarEspera } from "@/features/lista-espera/services/lista-espera";
import { hoyEnBogota } from "@/features/ventas/services/panel";
import { puede } from "@/shared/lib/permisos";

export const metadata: Metadata = { title: "Lista de espera" };

export default async function PaginaListaEspera() {
  const miembro = await exigirPermiso("ver_clientes");
  const filas = await listarEspera();
  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-4 lg:px-6 lg:py-6">
      <header>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-2xl">
          Lista de espera
        </h1>
        <p className="text-ac-pizarra">
          Clientes que pidieron en el sitio que les avisemos si se libera una
          hora. El aviso sale solo cuando una cita de ese día se cancela o se
          mueve.
        </p>
      </header>
      <ListaEsperaVista
        filas={filas}
        hoy={hoyEnBogota()}
        puedeQuitar={puede(miembro.rol, "crear_cita")}
      />
    </main>
  );
}
