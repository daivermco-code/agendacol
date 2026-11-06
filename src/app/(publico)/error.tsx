"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/shared/ui/button";

export default function ErrorPublico({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-ac-niebla-oscura text-ac-pizarra">
          <WifiOff className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="text-xl font-bold">No pudimos cargar esta página</h1>
        <p className="mt-1 text-ac-pizarra">
          Revisa tu conexión e intenta de nuevo en un momento.
        </p>
        <Button className="mt-6" onClick={reset}>
          <RefreshCw aria-hidden="true" />
          Intentar de nuevo
        </Button>
      </div>
    </main>
  );
}
