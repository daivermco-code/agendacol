import { Store } from "lucide-react";

export default function NegocioNoEncontrado() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-ac-niebla-oscura text-ac-pizarra">
          <Store className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="text-xl font-bold">No encontramos este negocio</h1>
        <p className="mt-1 text-ac-pizarra">
          Revisa el enlace que te compartieron; puede que esté mal escrito o que
          el negocio ya no reciba reservas aquí.
        </p>
      </div>
    </main>
  );
}
