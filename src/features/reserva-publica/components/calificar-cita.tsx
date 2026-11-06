"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { useRouter } from "next/navigation";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { Campo } from "@/shared/components/campo";
import { Estrellas } from "@/shared/components/estrellas";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { calificarCita } from "../actions";
import type { CitaPublica } from "../types";

const TEXTOS = ["", "Mala", "Regular", "Buena", "Muy buena", "Excelente"];

/** Calificación privada del profesional: de 1 a 5 estrellas y un comentario; una sola vez. */
export function CalificarCita({ cita }: { cita: CitaPublica }) {
  const router = useRouter();
  const [estrellas, setEstrellas] = useState(0);
  const [encima, setEncima] = useState(0);
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransicionRed();
  const nombre = cita.profesional.nombre.split(" ")[0];

  if (cita.calificacion) {
    return (
      <section className="rounded-lg border border-ac-borde bg-ac-papel p-4">
        <p className="font-semibold">Tu calificación</p>
        <Estrellas valor={cita.calificacion.estrellas} className="mt-1" />
        {cita.calificacion.comentario ? (
          <p className="mt-2 text-ac-pizarra">
            “{cita.calificacion.comentario}”
          </p>
        ) : null}
        <p className="mt-2 text-sm text-ac-neblina">
          Gracias: solo la ve el negocio.
        </p>
      </section>
    );
  }
  if (!cita.puedeCalificar) return null;

  function enviar() {
    if (!estrellas) return setError("Elige de 1 a 5 estrellas");
    iniciar(async () => {
      const r = await calificarCita({
        token: cita.token,
        estrellas,
        comentario,
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success("¡Gracias por tu calificación!");
      router.refresh();
    });
  }

  const visible = encima || estrellas;
  return (
    <section
      aria-labelledby="calificar-titulo"
      className="rounded-lg border border-ac-laguna/40 bg-ac-papel p-4 sm:p-5"
    >
      <h2 id="calificar-titulo" className="font-semibold">
        ¿Cómo te atendió {nombre}?
      </h2>
      <p className="text-sm text-ac-pizarra">
        Tu calificación es privada: solo la ve el negocio.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <div
          className="flex"
          role="radiogroup"
          aria-label="Estrellas"
          onMouseLeave={() => setEncima(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={estrellas === n}
              aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}: ${TEXTOS[n]}`}
              onMouseEnter={() => setEncima(n)}
              onClick={() => {
                setEstrellas(n);
                setError(null);
              }}
              disabled={enviando}
              className="rounded-md p-1.5 transition-transform hover:scale-110 md:p-1"
            >
              <Star
                aria-hidden="true"
                className={cn(
                  "h-8 w-8",
                  n <= visible
                    ? "fill-ac-aviso text-ac-aviso"
                    : "text-ac-borde-fuerte",
                )}
              />
            </button>
          ))}
        </div>
        <span
          className="text-sm font-medium text-ac-pizarra"
          aria-live="polite"
        >
          {TEXTOS[visible]}
        </span>
      </div>
      {error ? <p className="mt-1 text-xs text-ac-error">{error}</p> : null}
      <Campo
        id="calificar-comentario"
        etiqueta="Comentario"
        ayuda="Opcional"
        className="mt-3"
      >
        <Textarea
          id="calificar-comentario"
          rows={2}
          maxLength={500}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          disabled={enviando}
        />
      </Campo>
      <Button className="mt-3" onClick={enviar} disabled={enviando}>
        {enviando ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : null}
        Enviar calificación
      </Button>
    </section>
  );
}
