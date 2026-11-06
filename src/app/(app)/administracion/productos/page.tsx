import type { Metadata } from "next";
import { exigirPermiso } from "@/features/auth/services/miembro";
import { InventarioVista } from "@/features/inventario/components/inventario-vista";
import { listarProductos } from "@/features/inventario/services/productos";

export const metadata: Metadata = { title: "Productos" };

export default async function PaginaProductos({
  searchParams,
}: {
  searchParams: Promise<{ bajo?: string }>;
}) {
  await exigirPermiso("administrar");
  const [productos, params] = await Promise.all([
    listarProductos(),
    searchParams,
  ]);
  return (
    <main>
      <header className="mb-4">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-2xl">
          Productos
        </h1>
        <p className="text-ac-pizarra">
          Lo que vendes además de los servicios. Las existencias bajan solas con
          cada venta y vuelven si la anulas.
        </p>
      </header>
      <InventarioVista
        productos={productos}
        soloBajoInicial={params.bajo === "1"}
      />
    </main>
  );
}
