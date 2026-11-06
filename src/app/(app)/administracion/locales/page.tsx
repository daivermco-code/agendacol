import type { Metadata } from "next";
import { LocalesVista } from "@/features/administracion/components/locales-vista";
import { obtenerLocales } from "@/features/administracion/services/catalogo";

export const metadata: Metadata = { title: "Locales" };

export default async function PaginaLocales() {
  const locales = await obtenerLocales();
  return (
    <main>
      <header className="mb-4">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-2xl">
          Locales
        </h1>
        <p className="text-ac-pizarra">
          Datos de contacto, horario de atención y reservas en línea de cada
          local.
        </p>
      </header>
      <LocalesVista locales={locales} />
    </main>
  );
}
