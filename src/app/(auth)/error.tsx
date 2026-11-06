"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/shared/ui/button";

export default function ErrorDeIngreso({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-ac-error-fondo text-ac-error">
          <TriangleAlert className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="text-xl font-bold">No pudimos abrir el ingreso</h1>
        <p className="mt-1 text-ac-pizarra">
          Algo falló al cargar la página. Vuelve a intentar en un momento.
        </p>
        <Button className="mt-6" onClick={reset}>
          Volver a intentar
        </Button>
      </div>
    </main>
  );
}
