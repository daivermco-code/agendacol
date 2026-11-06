import type { Metadata } from "next";
import { exigirPermiso } from "@/features/auth/services/miembro";
import { GiftCardsVendidas } from "@/features/gift-cards/components/gift-cards-vendidas";
import { listarVendidas } from "@/features/gift-cards/services/gift-cards";

export const metadata: Metadata = { title: "Gift cards vendidas" };

export default async function PaginaGiftCardsVendidas() {
  await exigirPermiso("ver_ventas");
  const tarjetas = await listarVendidas();
  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-4 lg:px-6 lg:py-6">
      <header>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-2xl">
          Gift cards
        </h1>
        <p className="text-ac-pizarra">
          Las vendidas, su saldo y cuánto falta por canjear. Para pagar con una,
          elige «Gift card» en el método de pago y escribe su código.
        </p>
      </header>
      <GiftCardsVendidas tarjetas={tarjetas} />
    </main>
  );
}
