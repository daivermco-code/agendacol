import Link from "next/link";
import { Hammer } from "lucide-react";
import { Button } from "@/shared/ui/button";

/** Pantalla de una sección que todavía no está construida. */
export function ProximaOleada({
  titulo,
  resumen,
}: {
  titulo: string;
  resumen: string;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-ac-laguna-claro text-ac-laguna">
          <Hammer className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="text-xl font-bold">{titulo}</h1>
        <p className="mt-1 text-ac-pizarra">{resumen}</p>
        <p className="mt-4 inline-block rounded-full bg-ac-niebla-oscura px-3 py-1 text-[13px] font-medium text-ac-pizarra">
          Disponible en una próxima oleada
        </p>
        <div className="mt-6">
          <Button asChild variant="outline">
            <Link href="/agenda">Ir a la agenda</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
