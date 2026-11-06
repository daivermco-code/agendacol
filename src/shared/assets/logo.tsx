import { cn } from "@/shared/lib/utils";

interface LogoProps {
  className?: string;
  /** Muestra el nombre al lado del símbolo. */
  conNombre?: boolean;
  /** Colores para fondo oscuro (barra azul noche) o claro. */
  tono?: "oscuro" | "claro";
}

/** Símbolo propio de AgendaCol: una "C" que es también la esfera de un reloj, con las agujas en forma de visto. */
export function Logo({
  className,
  conNombre = true,
  tono = "oscuro",
}: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="h-7 w-7 shrink-0">
        <rect width="32" height="32" rx="8" fill="hsl(var(--ac-laguna))" />
        <path
          d="M23.2 10.4A9 9 0 1 0 23.2 21.6"
          fill="none"
          stroke="hsl(var(--ac-papel))"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path
          d="M12.2 16.4l3 3 5.6-6.6"
          fill="none"
          stroke="hsl(var(--ac-papel))"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {conNombre ? (
        <span
          className={cn(
            "text-[17px] font-bold tracking-tight",
            tono === "oscuro" ? "text-ac-sobre-noche" : "text-ac-tinta",
          )}
        >
          Agenda
          <span
            className={tono === "oscuro" ? "text-[#5FD3C6]" : "text-ac-laguna"}
          >
            Col
          </span>
        </span>
      ) : (
        <span className="sr-only">AgendaCol</span>
      )}
    </span>
  );
}
