import type { Metadata } from "next";
import { ProfesionalesVista } from "@/features/administracion/components/profesionales-vista";
import { obtenerProfesionales } from "@/features/administracion/services/catalogo";

export const metadata: Metadata = { title: "Profesionales" };

export default async function PaginaProfesionales() {
  const equipo = await obtenerProfesionales();
  return (
    <main>
      <header className="mb-2">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-2xl">
          Profesionales
        </h1>
        <p className="text-ac-pizarra">
          Quién atiende, qué servicios hace y en qué horario.
        </p>
      </header>
      <ProfesionalesVista equipo={equipo} />
    </main>
  );
}
