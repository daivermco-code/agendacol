import { Star } from "lucide-react";
import { cn } from "@/shared/lib/utils";

/** De 1 a 5 estrellas llenas, solo para leer (la calificación privada del profesional). */
export function Estrellas({
  valor,
  className,
}: {
  valor: number;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex gap-0.5", className)}
      role="img"
      aria-label={`${valor} de 5 estrellas`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden="true"
          className={cn(
            "h-4 w-4",
            n <= valor ? "fill-ac-aviso text-ac-aviso" : "text-ac-borde-fuerte",
          )}
        />
      ))}
    </span>
  );
}
