import type { Metadata } from "next";
import Link from "next/link";
import { exigirPermiso } from "@/features/auth/services/miembro";
import { ServiciosVista } from "@/features/administracion/components/servicios-vista";
import type { TipoServicio } from "@/features/administracion/schemas";
import { obtenerCatalogo } from "@/features/administracion/services/catalogo";
import { cn } from "@/shared/lib/utils";

export const metadata: Metadata = { title: "Servicios" };

const PESTANAS: { id: string; nombre: string; tipos: TipoServicio[] }[] = [
  { id: "servicios", nombre: "Servicios", tipos: ["servicio", "sesiones"] },
  { id: "clases", nombre: "Clases", tipos: ["clase"] },
  { id: "paquetes", nombre: "Paquetes", tipos: ["paquete"] },
];

export default async function PaginaServicios({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const miembro = await exigirPermiso("administrar");
  const [catalogo, { tab }] = await Promise.all([
    obtenerCatalogo(),
    searchParams,
  ]);
  const activa = PESTANAS.find((p) => p.id === tab) ?? PESTANAS[0];

  return (
    <main>
      <h1 className="sr-only">Servicios</h1>
      <nav
        aria-label="Tipo de servicio"
        className="flex gap-1 border-b border-ac-laguna"
      >
        {PESTANAS.map((p) => (
          <Link
            key={p.id}
            href={
              p.id === "servicios"
                ? "/administracion/servicios"
                : `/administracion/servicios?tab=${p.id}`
            }
            aria-current={p.id === activa.id ? "page" : undefined}
            className={cn(
              "rounded-t-lg border border-b-0 px-4 py-3 text-sm md:py-2.5",
              p.id === activa.id
                ? "border-ac-laguna bg-ac-papel font-semibold text-ac-laguna-hondo"
                : "border-transparent bg-ac-niebla-oscura text-ac-pizarra hover:text-ac-tinta",
            )}
          >
            {p.nombre}
          </Link>
        ))}
      </nav>
      <div className="rounded-b-lg bg-ac-papel p-4 shadow-quieta sm:p-5">
        <ServiciosVista
          key={activa.id}
          catalogo={catalogo}
          negocioId={miembro.negocioId}
          tipos={activa.tipos}
        />
      </div>
    </main>
  );
}
