import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Label } from "@/shared/ui/label";

interface CampoProps {
  id: string;
  etiqueta: string;
  obligatorio?: boolean;
  error?: string;
  ayuda?: string;
  className?: string;
  children: ReactNode;
}

/** Etiqueta arriba, control, y error de 12 px con ícono debajo (DESIGN.md §4). */
export function Campo({ id, etiqueta, obligatorio, error, ayuda, className, children }: CampoProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {etiqueta}
        {obligatorio ? <span className="text-ac-error"> *</span> : null}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1 text-xs text-ac-error">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : ayuda ? (
        <p className="text-xs text-ac-neblina">{ayuda}</p>
      ) : null}
    </div>
  );
}
