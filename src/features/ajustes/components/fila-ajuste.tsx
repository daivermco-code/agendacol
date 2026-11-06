import type { ReactNode } from "react";

/** Una fila de ajustes: título y explicación a la izquierda, el control a la derecha. */
export function Fila({
  titulo,
  texto,
  children,
}: {
  titulo: string;
  texto?: string;
  children: ReactNode;
}) {
  return (
    // En celular, si los controles no caben al lado del texto, bajan a su propia línea (sin salirse de la tarjeta).
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-ac-borde py-4 last:border-b-0">
      <div className="min-w-0 flex-1 basis-48">
        <p className="font-medium">{titulo}</p>
        {texto ? (
          <p className="mt-0.5 text-sm text-ac-pizarra">{texto}</p>
        ) : null}
      </div>
      <div className="ml-auto max-w-full shrink-0">{children}</div>
    </div>
  );
}

export const SELECT =
  "h-11 md:h-9 rounded-md border border-ac-borde bg-ac-papel px-3";
