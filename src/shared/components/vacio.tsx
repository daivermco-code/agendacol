import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Estado vacío: dice qué falta y ofrece la acción que lo resuelve. */
export function Vacio({ icono: Icono, titulo, texto, accion }: { icono: LucideIcon; titulo: string; texto: string; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-ac-borde-fuerte bg-ac-papel px-6 py-12 text-center">
      <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-ac-niebla text-ac-pizarra">
        <Icono className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="font-semibold">{titulo}</p>
      <p className="mt-1 max-w-sm text-ac-pizarra">{texto}</p>
      {accion ? <div className="mt-4">{accion}</div> : null}
    </div>
  );
}
