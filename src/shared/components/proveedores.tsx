"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/shared/ui/tooltip";

export function Proveedores({ children }: { children: ReactNode }) {
  const [cliente] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
          // Sin red un cambio falla al instante (y se deshace) en vez de quedar en pausa y mandarse solo al volver
          // la red, cuando quizá ya no aplica (T-11.4). Las consultas sí esperan la red: lo cargado se sigue viendo.
          mutations: { networkMode: "always" },
        },
      }),
  );

  return (
    <QueryClientProvider client={cliente}>
      <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}
