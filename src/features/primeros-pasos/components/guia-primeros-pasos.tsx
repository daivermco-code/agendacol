"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { PASOS, TOTAL_PASOS, rutaDelPaso } from "../lib/pasos";

interface Caja {
  top: number;
  left: number;
  width: number;
  height: number;
  /** Redondeo del control, para que el aro de luz tenga su misma forma. */
  radio: string;
}

const igual = (a: Caja | null, b: Caja) =>
  a !== null &&
  a.top === b.top &&
  a.left === b.left &&
  a.width === b.width &&
  a.height === b.height &&
  a.radio === b.radio;

const MARGEN = 16;
const ANCHO = 330;
const SEPARACION = 14;

/** El primer control visible marcado con `data-guia=clave` (en celular y en computador puede ser otro). */
function buscarObjetivo(clave: string): HTMLElement | null {
  const todos = document.querySelectorAll<HTMLElement>(
    `[data-guia="${clave}"]`,
  );
  for (const el of todos) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/**
 * Busca el control del paso (la pantalla puede tardar en traer sus datos), lo trae a la vista y sigue su
 * posición mientras la pantalla se mueve. `listo` llega cuando terminó de buscar; si en 4 s no apareció, la
 * caja queda en null y el globo va abajo, sin flecha.
 */
function useObjetivo(clave: string | null, alTocar: () => void) {
  const [caja, setCaja] = useState<Caja | null>(null);
  const [listo, setListo] = useState(false);
  const tocar = useRef(alTocar);
  useEffect(() => {
    tocar.current = alTocar;
  }, [alTocar]);

  useEffect(() => {
    if (!clave) return;
    let el: HTMLElement | null = null;
    let intentos = 0;
    const alClic = () => tocar.current();
    const medir = () => {
      if (!el || !el.isConnected) el = buscarObjetivo(clave);
      if (!el) return setCaja(null);
      const r = el.getBoundingClientRect();
      const nueva = {
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
        radio: getComputedStyle(el).borderRadius,
      };
      setCaja((antes) => (igual(antes, nueva) ? antes : nueva));
    };
    const buscar = window.setInterval(() => {
      el = buscarObjetivo(clave);
      if (el || ++intentos > 20) {
        window.clearInterval(buscar);
        el?.scrollIntoView({ block: "center", inline: "nearest" });
        el?.addEventListener("click", alClic);
        medir();
        setListo(true);
      }
    }, 200);
    const seguir = window.setInterval(medir, 300);
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      window.clearInterval(buscar);
      window.clearInterval(seguir);
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
      el?.removeEventListener("click", alClic);
      setCaja(null);
      setListo(false);
    };
  }, [clave]);

  return { caja, listo };
}

const limitar = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max);

/** Lo que tapa abajo la barra de pestañas del celular (0 si no se ve). */
function altoPestanas(vh: number): number {
  const barra = document.querySelector("[data-pestanas]");
  if (!barra) return 0;
  const { top, height } = barra.getBoundingClientRect();
  return height > 0 ? Math.max(0, vh - top) : 0;
}

/** Dónde va el globo: debajo del control si ahí hay más espacio, si no encima; centrado y dentro de la pantalla. */
function ubicar(caja: Caja | null) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const ancho = Math.min(ANCHO, vw - 2 * MARGEN);
  if (!caja) {
    return {
      estilo: {
        left: (vw - ancho) / 2,
        bottom: MARGEN + altoPestanas(vh),
        width: ancho,
      },
      flecha: null,
    };
  }
  const centro = caja.left + caja.width / 2;
  const left = limitar(centro - ancho / 2, MARGEN, vw - ancho - MARGEN);
  const x = limitar(centro - left, 18, ancho - 18);
  const abajo = vh - (caja.top + caja.height) >= caja.top;
  return abajo
    ? {
        estilo: {
          left,
          top: caja.top + caja.height + SEPARACION,
          width: ancho,
        },
        flecha: { lado: "arriba" as const, x },
      }
    : {
        estilo: { left, bottom: vh - caja.top + SEPARACION, width: ancho },
        flecha: { lado: "abajo" as const, x },
      };
}

/**
 * Recorrido guiado de "Primeros pasos": con `?guia=n` en la dirección, ilumina el control del paso n y abre un
 * globo con "Paso n de 6", Anterior, Siguiente y Saltar. Cada paso vive en su pantalla, así que avanzar navega.
 * Tocar el control iluminado cierra el globo: la persona ya está haciendo el paso.
 */
export function GuiaPrimerosPasos() {
  const parametros = useSearchParams();
  const ruta = usePathname();
  const router = useRouter();
  const n = Number(parametros.get("guia"));
  const activo = Number.isInteger(n) && n >= 1 && n <= TOTAL_PASOS;
  const paso = activo ? PASOS[n - 1] : null;
  const globo = useRef<HTMLDivElement>(null);

  const cerrar = useCallback(() => {
    const resto = new URLSearchParams(parametros.toString());
    resto.delete("guia");
    const q = resto.toString();
    router.replace(q ? `${ruta}?${q}` : ruta, { scroll: false });
  }, [parametros, ruta, router]);

  const { caja, listo } = useObjetivo(
    paso && ruta === paso.ruta ? paso.clave : null,
    cerrar,
  );

  useEffect(() => {
    if (!paso || !listo) return;
    globo.current?.focus({ preventScroll: true });
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    window.addEventListener("keydown", alTeclado);
    return () => window.removeEventListener("keydown", alTeclado);
  }, [paso, listo, cerrar]);

  if (!paso || ruta !== paso.ruta || !listo) return null;
  const { estilo, flecha } = ubicar(caja);
  const ultimo = n === TOTAL_PASOS;

  return (
    <>
      {caja ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-40 ring-2 ring-ac-laguna ring-offset-2 transition-all motion-reduce:transition-none"
          style={{
            top: caja.top - 4,
            left: caja.left - 4,
            width: caja.width + 8,
            height: caja.height + 8,
            borderRadius: `calc(${caja.radio} + 4px)`,
            boxShadow: "0 0 0 9999px hsl(var(--ac-noche) / 0.35)",
          }}
        />
      ) : null}
      <div
        ref={globo}
        role="dialog"
        aria-modal="false"
        aria-labelledby="guia-titulo"
        aria-describedby="guia-texto"
        tabIndex={-1}
        className="fixed z-50 rounded-lg border border-ac-borde bg-ac-papel p-4 shadow-modal outline-none"
        style={estilo}
      >
        {flecha ? (
          <span
            aria-hidden="true"
            className={cn(
              "absolute h-3 w-3 -translate-x-1/2 rotate-45 border-ac-borde bg-ac-papel",
              flecha.lado === "arriba"
                ? "-top-1.5 border-l border-t"
                : "-bottom-1.5 border-b border-r",
            )}
            style={{ left: flecha.x }}
          />
        ) : null}
        <ContenidoGlobo
          n={n}
          titulo={paso.titulo}
          texto={paso.texto}
          ultimo={ultimo}
          onCerrar={cerrar}
          onIr={(m) =>
            router.push(m > TOTAL_PASOS ? "/primeros-pasos" : rutaDelPaso(m))
          }
        />
      </div>
    </>
  );
}

function ContenidoGlobo({
  n,
  titulo,
  texto,
  ultimo,
  onCerrar,
  onIr,
}: {
  n: number;
  titulo: string;
  texto: string;
  ultimo: boolean;
  onCerrar: () => void;
  onIr: (paso: number) => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="cifras text-xs font-semibold uppercase tracking-wide text-ac-laguna-hondo">
          Paso {n} de {TOTAL_PASOS}
        </p>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar el recorrido"
          className="area-tactil -mr-1 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-ac-pizarra hover:bg-ac-niebla"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <h2 id="guia-titulo" className="mt-0.5 font-bold">
        {titulo}
      </h2>
      <p id="guia-texto" className="mt-1 text-sm text-ac-pizarra">
        {texto}
      </p>
      <div className="mt-3 flex items-center gap-1" aria-hidden="true">
        {Array.from({ length: TOTAL_PASOS }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              i < n ? "bg-ac-laguna" : "bg-ac-borde",
            )}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onCerrar}>
          Saltar
        </Button>
        <span className="flex-1" />
        {n > 1 ? (
          <Button variant="outline" size="sm" onClick={() => onIr(n - 1)}>
            Anterior
          </Button>
        ) : null}
        <Button size="sm" onClick={() => onIr(n + 1)}>
          {ultimo ? "Terminar" : "Siguiente"}
        </Button>
      </div>
    </>
  );
}
