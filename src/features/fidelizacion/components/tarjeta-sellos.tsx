import { Check } from "lucide-react";
import { cn } from "@/shared/lib/utils";

/** La tarjeta en curso: un círculo por sello, los ganados en color. */
export function PuntosSellos({
  enTarjeta,
  meta,
  className,
}: {
  enTarjeta: number;
  meta: number;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={`${enTarjeta} de ${meta} sellos`}
      className={cn("inline-flex flex-wrap gap-1", className)}
    >
      {Array.from({ length: meta }, (_, i) => (
        <span
          key={i}
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded-full border",
            i < enTarjeta
              ? "border-ac-laguna bg-ac-laguna text-ac-papel"
              : "border-dashed border-ac-borde-fuerte bg-ac-papel",
          )}
        >
          {i < enTarjeta ? (
            <Check className="h-3 w-3" aria-hidden="true" />
          ) : null}
        </span>
      ))}
    </span>
  );
}
