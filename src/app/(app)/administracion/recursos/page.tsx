import type { Metadata } from "next";
import { exigirPermiso } from "@/features/auth/services/miembro";
import { RecursosVista } from "@/features/recursos/components/recursos-vista";
import {
  listarRecursos,
  localesParaRecurso,
  serviciosParaRecurso,
} from "@/features/recursos/services/recursos";

export const metadata: Metadata = { title: "Recursos" };

export default async function PaginaRecursos() {
  await exigirPermiso("administrar");
  const [recursos, locales, servicios] = await Promise.all([
    listarRecursos(),
    localesParaRecurso(),
    serviciosParaRecurso(),
  ]);
  return (
    <main>
      <header className="mb-4">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-2xl">
          Recursos
        </h1>
        <p className="text-ac-pizarra">
          Salas, sillas y equipos de cada local. La agenda puede verse por
          recursos en la vista de día.
        </p>
      </header>
      <RecursosVista
        recursos={recursos}
        locales={locales}
        servicios={servicios}
      />
    </main>
  );
}
