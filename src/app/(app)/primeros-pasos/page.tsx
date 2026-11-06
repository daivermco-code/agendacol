import type { Metadata } from "next";
import { exigirPermiso } from "@/features/auth/services/miembro";
import { ListaPasos } from "@/features/primeros-pasos/components/lista-pasos";
import { estadoDePasos } from "@/features/primeros-pasos/services/pasos";

export const metadata: Metadata = { title: "Primeros pasos" };

export default async function PaginaPrimerosPasos() {
  await exigirPermiso("editar_ajustes");
  const estado = await estadoDePasos();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-4 pb-24 lg:px-6 lg:py-6">
      <ListaPasos estado={estado} />
    </main>
  );
}
