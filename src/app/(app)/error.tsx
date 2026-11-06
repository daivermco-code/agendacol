"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { esErrorDeRed } from "@/shared/lib/red";
import { Button } from "@/shared/ui/button";

export default function ErrorDeSeccion({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // Sin red: no es una falla de la base, es que esta pantalla necesita internet (T-11.7).
  const sinRed = esErrorDeRed(error);
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-ac-error-fondo text-ac-error">
          <TriangleAlert className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="text-xl font-bold">
          {sinRed ? "Sin conexión" : "Algo falló al cargar esta sección"}
        </h1>
        <p className="mt-1 text-ac-pizarra">
          {sinRed
            ? "Esta pantalla necesita internet. Cuando vuelva la red, vuelve a intentar."
            : "Puede que la base local esté apagada. Revisa que Docker y Supabase estén arriba y vuelve a intentar."}
        </p>
        <Button className="mt-6" onClick={reset}>
          Volver a intentar
        </Button>
      </div>
    </main>
  );
}
