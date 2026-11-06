import type { Metadata } from "next";
import { NumeracionVentas } from "@/features/ventas/components/numeracion";
import { leerNumeracion } from "@/features/ventas/services/caja";

export const metadata: Metadata = { title: "Numeración de ventas" };

export default async function PaginaNumeracion() {
  const datos = await leerNumeracion();
  return (
    <main>
      <header className="mb-4">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-2xl">
          Numeración de ventas
        </h1>
        <p className="text-ac-pizarra">
          El número correlativo que la base pone a cada venta, sin saltos ni
          repetidos.
        </p>
      </header>
      <NumeracionVentas
        key={`${datos.prefijo}${datos.siguiente}`}
        datos={datos}
      />
    </main>
  );
}
