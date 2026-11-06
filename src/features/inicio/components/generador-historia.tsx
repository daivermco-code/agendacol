"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Hoja } from "@/shared/components/hoja";
import { cn } from "@/shared/lib/utils";
import {
  ALTO,
  ANCHO,
  COLORES,
  dibujarHistoria,
  type DatosHistoria,
  type Estilo,
} from "../lib/historia";

const CLAVE = "agedacol-historia";

interface Preferencias {
  color: string;
  estilo: Estilo;
}

function leerPreferencias(): Preferencias {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) ?? "{}") as Partial<
      Record<string, unknown>
    >;
    const color = COLORES.some((c) => c.valor === g.color)
      ? (g.color as string)
      : COLORES[0].valor;
    const estilo = g.estilo === "oscuro" ? "oscuro" : "claro";
    return { color, estilo };
  } catch {
    return { color: COLORES[0].valor, estilo: "claro" };
  }
}

function guardarPreferencias(p: Preferencias) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(p));
  } catch {
    // Sin almacenamiento (modo privado): el color no se recuerda y ya.
  }
}

function descargar(archivo: File) {
  const url = URL.createObjectURL(archivo);
  const a = document.createElement("a");
  a.href = url;
  a.download = archivo.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Archivo PNG de la historia, o null si el navegador no pudo crearlo. */
function aArchivo(lienzo: HTMLCanvasElement): Promise<File | null> {
  return new Promise((listo) =>
    lienzo.toBlob(
      (b) =>
        listo(
          b ? new File([b], "horas-libres.png", { type: "image/png" }) : null,
        ),
      "image/png",
    ),
  );
}

/**
 * Generador de historia (T-12.9): una imagen vertical con la franja libre y el enlace de reserva, en 7 colores y
 * claro u oscuro. "Compartir" usa el menú del celular; si el navegador no comparte archivos, "Descargar".
 */
export function GeneradorHistoria({
  abierta,
  onCambiar,
  datos,
  slug,
}: {
  abierta: boolean;
  onCambiar: (abierta: boolean) => void;
  datos: Omit<DatosHistoria, "enlace">;
  slug: string;
}) {
  const [pref, setPref] = useState<Preferencias | null>(null);
  const [lienzo, setLienzo] = useState<HTMLCanvasElement | null>(null);
  const [comparte, setComparte] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  /** Enlace de reserva: sin protocolo en la imagen y completo en el texto que se comparte. */
  const enlace = useRef({ corto: "", completo: "" });

  // Al abrir (siempre tras un toque, nunca en el servidor): lo guardado en el equipo y si el navegador
  // comparte archivos (los computadores, casi nunca).
  if (abierta && pref === null) {
    setPref(leerPreferencias());
    const prueba = new File([""], "x.png", { type: "image/png" });
    setComparte(Boolean(navigator.canShare?.({ files: [prueba] })));
  }
  const { color, estilo } = pref ?? {
    color: COLORES[0].valor,
    estilo: "claro" as Estilo,
  };

  useEffect(() => {
    if (!lienzo) return;
    let vigente = true;
    enlace.current = {
      corto: `${window.location.host}/reservar/${slug}`,
      completo: `${window.location.origin}/reservar/${slug}`,
    };
    const letra =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--font-figtree")
        .trim() || "sans-serif";
    const ctx = lienzo.getContext("2d");
    // Con la letra ya cargada, para que el canvas no la dibuje con la de reemplazo.
    void document.fonts.ready.then(() => {
      if (!vigente || !ctx) return;
      dibujarHistoria(
        ctx,
        { ...datos, enlace: enlace.current.corto },
        color,
        estilo,
        letra,
      );
    });
    return () => {
      vigente = false;
    };
  }, [lienzo, datos, color, estilo, slug]);

  const elegir = (cambio: Partial<Preferencias>) => {
    const nuevo = { color, estilo, ...cambio };
    setPref(nuevo);
    guardarPreferencias(nuevo);
  };

  const enviar = async () => {
    if (!lienzo || ocupado) return;
    setOcupado(true);
    try {
      const archivo = await aArchivo(lienzo);
      if (!archivo) {
        toast.error("No se pudo crear la imagen. Inténtalo de nuevo.");
        return;
      }
      if (comparte && navigator.canShare?.({ files: [archivo] })) {
        try {
          await navigator.share({
            files: [archivo],
            title: `Horas libres ${datos.cuando}`,
            text: `Reserva tu hora en ${enlace.current.completo}`,
          });
          return;
        } catch (e) {
          // Cerrar el menú de compartir no es un error; si el celular no deja compartir, se descarga.
          if (e instanceof DOMException && e.name === "AbortError") return;
        }
      }
      descargar(archivo);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Hoja
      abierta={abierta}
      onCambiar={onCambiar}
      titulo="Compartir historia"
      className="h-[96dvh]"
      pie={
        <button
          type="button"
          onClick={() => void enviar()}
          disabled={ocupado}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ac-laguna text-[16px] font-semibold text-ac-papel hover:bg-ac-laguna-hondo disabled:opacity-60"
        >
          {comparte ? (
            <Share2 className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Download className="h-5 w-5" aria-hidden="true" />
          )}
          {comparte ? "Compartir" : "Descargar"}
        </button>
      }
    >
      <div className="space-y-5">
        <canvas
          ref={setLienzo}
          width={ANCHO}
          height={ALTO}
          role="img"
          aria-label={`Historia: horas libres ${datos.cuando}`}
          className="mx-auto block aspect-[9/16] w-full max-w-[260px] rounded-3xl border border-ac-borde shadow-flota"
        />
        <div>
          <p className="mb-1 text-[14px] font-semibold">Color</p>
          <div
            role="group"
            aria-label="Color"
            className="-mx-1 flex gap-1 overflow-x-auto"
          >
            {COLORES.map((c) => (
              <button
                key={c.valor}
                type="button"
                aria-label={c.nombre}
                aria-pressed={color === c.valor}
                onClick={() => elegir({ color: c.valor })}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              >
                <span
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-full text-white",
                    color === c.valor &&
                      "ring-2 ring-ac-tinta ring-offset-2 ring-offset-ac-papel",
                  )}
                  style={{ backgroundColor: c.valor }}
                >
                  {color === c.valor ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[14px] font-semibold">Estilo</p>
          <div
            role="group"
            aria-label="Estilo"
            className="flex rounded-full bg-ac-niebla p-1"
          >
            {(
              [
                ["claro", "Claro"],
                ["oscuro", "Oscuro"],
              ] as const
            ).map(([valor, nombre]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={estilo === valor}
                onClick={() => elegir({ estilo: valor })}
                className={cn(
                  "h-11 rounded-full px-4 text-[14px] font-semibold text-ac-pizarra",
                  estilo === valor && "bg-ac-papel text-ac-tinta shadow-sm",
                )}
              >
                {nombre}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Hoja>
  );
}
