import { Logo } from "@/shared/assets/logo";

/** Sitio de reservas y enlace del cliente: sin la barra de la app y sin sesión. */
export default function PublicoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-ac-niebla">
      <aside
        aria-label="Aviso de la demo"
        className="flex h-franja items-center justify-center bg-ac-demo-fondo px-4 text-[13px] text-ac-demo-texto sm:text-sm"
      >
        <p className="truncate">
          <span className="font-semibold">Sitio de reservas de la demo</span>
          <span className="hidden sm:inline">
            {" "}
            · los avisos llegan al buzón de la demo, no se envía nada
          </span>
        </p>
      </aside>
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="border-t border-ac-borde bg-ac-papel py-5 text-center text-xs text-ac-neblina">
        <span className="inline-flex items-center gap-2">
          Reservas con
          <Logo tono="claro" className="[&_svg]:h-5 [&_svg]:w-5" />
        </span>
      </footer>
    </div>
  );
}
