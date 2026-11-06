import type { Metadata } from "next";
import { exigirPermiso } from "@/features/auth/services/miembro";
import { PlanesVendidos } from "@/features/planes/components/planes-vendidos";
import { listarBonos } from "@/features/planes/services/planes";
import { hoyEnBogota } from "@/features/ventas/services/panel";

export const metadata: Metadata = { title: "Planes vendidos" };

export default async function PaginaPlanesVendidos() {
  await exigirPermiso("ver_ventas");
  const bonos = await listarBonos();
  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-4 lg:px-6 lg:py-6">
      <header>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-2xl">
          Planes
        </h1>
        <p className="text-ac-pizarra">
          Planes, sesiones y paquetes vendidos: cuántas citas lleva cada cliente
          y cuándo vencen. Para usar uno, abre la cita en la agenda y elige
          «Usar plan».
        </p>
      </header>
      <PlanesVendidos bonos={bonos} hoy={hoyEnBogota()} />
    </main>
  );
}
