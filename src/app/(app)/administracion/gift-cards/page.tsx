import type { Metadata } from "next";
import { exigirPermiso } from "@/features/auth/services/miembro";
import { CatalogoGiftCards } from "@/features/gift-cards/components/catalogo-gift-cards";
import { listarModelos } from "@/features/gift-cards/services/gift-cards";

export const metadata: Metadata = { title: "Gift cards" };

export default async function PaginaCatalogoGiftCards() {
  await exigirPermiso("administrar");
  const modelos = await listarModelos();
  return (
    <main>
      <header className="mb-4">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-2xl">
          Gift cards
        </h1>
        <p className="text-ac-pizarra">
          Tarjetas de regalo que vendes en la caja. Cada una sale con un código
          propio para pagar con su saldo.
        </p>
      </header>
      <CatalogoGiftCards modelos={modelos} />
    </main>
  );
}
