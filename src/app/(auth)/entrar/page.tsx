import type { Metadata } from "next";
import { FormularioEntrar } from "@/features/auth/components/formulario-entrar";
import { rutaSegura } from "@/features/auth/schemas";
import { Logo } from "@/shared/assets/logo";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaEntrar({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  const { volver } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col">
      <div className="flex h-franja items-center justify-center bg-ac-demo-fondo px-4 text-[13px] text-ac-demo-texto">
        <span className="font-semibold">Demo personal de AgendaCol</span>&nbsp;·
        datos inventados
      </div>
      <div className="flex h-barra items-center justify-center bg-ac-noche lg:justify-start lg:px-6">
        <Logo />
      </div>
      <div className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
        <section className="w-full max-w-[420px] rounded-lg border border-ac-borde bg-ac-papel p-6 shadow-quieta sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight">Entrar</h1>
          <p className="mb-6 mt-1 text-ac-pizarra">
            Agenda y gestión de Salón Ceiba, un negocio de ejemplo.
          </p>
          <FormularioEntrar volver={volver ? rutaSegura(volver) : undefined} />
        </section>
      </div>
    </main>
  );
}
