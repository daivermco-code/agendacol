import { Download } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { buttonVariants } from "@/shared/ui/button";

/** "Exportar": descarga el listado en CSV (abre bien en Excel) con los filtros que se están viendo. */
export function BotonExportar({
  href,
  className,
}: {
  href: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      download
      className={cn(buttonVariants({ variant: "outline" }), className)}
    >
      <Download className="h-4 w-4" aria-hidden="true" /> Exportar
    </a>
  );
}
