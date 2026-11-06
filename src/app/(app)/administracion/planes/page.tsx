import type { Metadata } from "next";
import { exigirPermiso } from "@/features/auth/services/miembro";
import { CatalogoPlanes } from "@/features/planes/components/catalogo-planes";
import {
  listarPlanes,
  serviciosParaPlan,
} from "@/features/planes/services/planes";

export const metadata: Metadata = { title: "Planes" };

export default async function PaginaCatalogoPlanes() {
  await exigirPermiso("administrar");
  const [planes, servicios] = await Promise.all([
    listarPlanes(),
    serviciosParaPlan(),
  ]);
  return (
    <main>
      <header className="mb-4">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-2xl">
          Planes
        </h1>
        <p className="text-ac-pizarra">
          Membresías y planes de citas que el cliente paga por adelantado. Los
          servicios con sesiones y los paquetes se crean en Servicios.
        </p>
      </header>
      <CatalogoPlanes planes={planes} servicios={servicios} />
    </main>
  );
}
