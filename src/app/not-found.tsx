import Link from "next/link";
import { connection } from "next/server";
import { MapPinOff } from "lucide-react";
import { Logo } from "@/shared/assets/logo";
import { Button } from "@/shared/ui/button";

export default async function NoEncontrada() {
  // Por pedido, no estática: el HTML guardado en el build no tendría el nonce de la CSP y sus scripts no correrían.
  await connection();
  return (
    <main className="flex min-h-dvh flex-col">
      <div className="flex h-barra items-center justify-center bg-ac-noche lg:justify-start lg:px-6">
        <Logo />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="max-w-md text-center">
          <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-ac-niebla-oscura text-ac-pizarra">
            <MapPinOff className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="text-xl font-bold">Esta página no existe</h1>
          <p className="mt-1 text-ac-pizarra">
            Puede que la dirección esté mal escrita o que la sección se haya
            movido.
          </p>
          <Button asChild className="mt-6">
            <Link href="/">Volver al inicio</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
