"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, Plus, Search } from "lucide-react";
import { Hoja } from "@/shared/components/hoja";
import { duracion, pesos } from "@/shared/lib/formato";
import { iniciales } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { buscarClientes } from "@/features/clientes/actions";
import { useRetrasado } from "@/features/clientes/components/buscador-clientes";
import type { ClienteResumen } from "@/features/clientes/schemas";
import { normalizar } from "@/features/agenda/lib/busqueda";
import type { ServicioAgenda } from "@/features/agenda/types";

/** Botón que abre la hoja: se ve como un campo de 44 px (el celular no llega a `md:`). */
const DISPARADOR =
  "flex h-11 w-full items-center gap-2 rounded-md border border-ac-borde bg-ac-papel px-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac-foco disabled:cursor-not-allowed disabled:bg-ac-niebla disabled:text-ac-neblina data-[invalido=true]:border-ac-error";
const FILA =
  "flex min-h-14 w-full items-center gap-3 py-2 text-left active:bg-ac-laguna-claro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ac-foco";

function Buscador({
  id,
  etiqueta,
  placeholder,
  valor,
  onCambio,
  caja,
}: {
  id: string;
  etiqueta: string;
  placeholder: string;
  valor: string;
  onCambio: (v: string) => void;
  caja?: Ref<HTMLInputElement>;
}) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-2.5 top-3.5 h-4 w-4 text-ac-neblina"
        aria-hidden="true"
      />
      <Input
        ref={caja}
        id={id}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        aria-label={etiqueta}
        placeholder={placeholder}
        className="pl-8"
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
      />
    </div>
  );
}

const Nota = ({ children }: { children: ReactNode }) => (
  <p className="py-6 text-center text-sm text-ac-pizarra">{children}</p>
);

/** Botón "Buscar cliente…" del celular: abre `HojaElegirCliente`. */
export function BotonBuscarCliente({
  id,
  invalido,
  onAbrir,
}: {
  id: string;
  invalido?: boolean;
  onAbrir: () => void;
}) {
  return (
    <button
      type="button"
      id={id}
      aria-haspopup="dialog"
      data-invalido={invalido || undefined}
      aria-describedby={invalido ? `${id}-error` : undefined}
      onClick={onAbrir}
      className={DISPARADOR}
    >
      <Search className="h-4 w-4 shrink-0 text-ac-neblina" aria-hidden="true" />
      <span className="text-ac-neblina">Buscar cliente…</span>
    </button>
  );
}

/**
 * Selector de cliente del celular (T-12.4): búsqueda por nombre, teléfono, correo o documento y "Crear cliente
 * nuevo" fijo abajo. Vive aparte del botón porque al elegir el botón se cambia por la tarjeta del cliente: así la
 * hoja se cierra con su animación en vez de desmontarse abierta.
 */
export function HojaElegirCliente({
  id,
  abierta,
  onCambiar,
  onElegir,
  onNuevo,
  volverA,
}: {
  id: string;
  abierta: boolean;
  onCambiar: (abierta: boolean) => void;
  onElegir: (c: ClienteResumen) => void;
  onNuevo: (texto: string) => void;
  volverA?: () => HTMLElement | null;
}) {
  const [texto, setTexto] = useState("");
  const caja = useRef<HTMLInputElement>(null);
  const buscado = useRetrasado(texto.trim());
  const consulta = useQuery({
    queryKey: ["clientes-busqueda", buscado],
    queryFn: () => buscarClientes(buscado),
    enabled: abierta && buscado.length >= 2,
    staleTime: 30_000,
  });
  const resultados = buscado.length >= 2 ? (consulta.data ?? []) : [];

  // Lo primero es escribir: el foco pasa de la hoja a la caja de búsqueda.
  useEffect(() => {
    if (!abierta) return;
    const r = requestAnimationFrame(() => caja.current?.focus());
    return () => cancelAnimationFrame(r);
  }, [abierta]);

  function cambiar(v: boolean) {
    onCambiar(v);
    if (!v) setTexto("");
  }

  return (
    <Hoja
      abierta={abierta}
      onCambiar={cambiar}
      titulo="Elegir cliente"
      className="h-[85dvh]"
      volverA={volverA}
      pie={
        <Button
          type="button"
          className="h-12 w-full"
          onClick={() => {
            const t = texto.trim();
            cambiar(false);
            onNuevo(t);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Crear cliente nuevo
        </Button>
      }
    >
      <Buscador
        id={`${id}-buscar`}
        etiqueta="Buscar cliente"
        placeholder="Nombre, teléfono, correo o documento"
        valor={texto}
        onCambio={setTexto}
        caja={caja}
      />
      <div aria-live="polite">
        {texto.trim().length < 2 ? (
          <Nota>Escribe al menos 2 letras para buscar.</Nota>
        ) : buscado !== texto.trim() ||
          (consulta.isFetching && !resultados.length) ? (
          <Nota>
            <Loader2
              className="mr-1 inline h-4 w-4 animate-spin"
              aria-hidden="true"
            />
            Buscando…
          </Nota>
        ) : resultados.length === 0 ? (
          <Nota>No hay clientes con «{buscado}».</Nota>
        ) : null}
      </div>
      {resultados.length && buscado === texto.trim() ? (
        <ul
          aria-label="Clientes encontrados"
          className="mt-2 divide-y divide-ac-borde"
        >
          {resultados.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={FILA}
                onClick={() => {
                  onElegir(c);
                  cambiar(false);
                }}
              >
                <span
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ac-laguna-claro text-xs font-bold text-ac-laguna-hondo"
                  aria-hidden="true"
                >
                  {iniciales(c.nombre, c.apellido)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {c.nombre} {c.apellido}
                  </span>
                  <span className="block truncate text-xs text-ac-pizarra">
                    {[c.telefono, c.correo, c.documento]
                      .filter(Boolean)
                      .join(" · ") || "Sin contacto"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Hoja>
  );
}

/** Selector de servicio del celular (T-12.4): búsqueda y lista por categoría con duración y precio. */
export function SelectorServicio({
  id,
  servicios,
  valor,
  deshabilitado,
  invalido,
  onElegir,
}: {
  id: string;
  servicios: ServicioAgenda[];
  valor: string;
  deshabilitado: boolean;
  invalido?: boolean;
  onElegir: (id: string) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const [texto, setTexto] = useState("");
  const base = useId();
  const elegido = servicios.find((s) => s.id === valor);
  const t = normalizar(texto);
  const visibles = t
    ? servicios.filter((s) =>
        normalizar(`${s.nombre} ${s.categoria}`).includes(t),
      )
    : servicios;
  const categorias = [...new Set(visibles.map((s) => s.categoria))];

  function cambiar(v: boolean) {
    setAbierta(v);
    if (!v) setTexto("");
  }

  return (
    <>
      <button
        type="button"
        id={id}
        aria-haspopup="dialog"
        disabled={deshabilitado}
        data-invalido={invalido || undefined}
        aria-describedby={invalido ? `${id}-error` : undefined}
        onClick={() => setAbierta(true)}
        className={DISPARADOR}
      >
        {elegido ? (
          <span className="min-w-0 flex-1 truncate">
            {elegido.nombre} · {duracion(elegido.duracionMin)} ·{" "}
            {pesos(elegido.precio)}
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-ac-neblina">
            {deshabilitado
              ? "Elige un profesional primero"
              : "Elige un servicio"}
          </span>
        )}
        <ChevronDown
          className="h-4 w-4 shrink-0 text-ac-pizarra"
          aria-hidden="true"
        />
      </button>
      <Hoja
        abierta={abierta}
        onCambiar={cambiar}
        titulo="Elegir servicio"
        className="h-[85dvh]"
      >
        <Buscador
          id={`${id}-buscar`}
          etiqueta="Buscar servicio"
          placeholder="Nombre o categoría"
          valor={texto}
          onCambio={setTexto}
        />
        {visibles.length === 0 ? (
          <Nota>Ningún servicio coincide con «{texto.trim()}».</Nota>
        ) : (
          categorias.map((c, i) => (
            <section key={c} aria-labelledby={`${base}-${i}`}>
              <h3
                id={`${base}-${i}`}
                className="pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-ac-pizarra"
              >
                {c || "Servicios"}
              </h3>
              <ul className="divide-y divide-ac-borde">
                {visibles
                  .filter((s) => s.categoria === c)
                  .map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        aria-pressed={s.id === valor}
                        className={FILA}
                        onClick={() => {
                          onElegir(s.id);
                          cambiar(false);
                        }}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{s.nombre}</span>
                          <span className="cifras block text-xs text-ac-pizarra">
                            {duracion(s.duracionMin)} · {pesos(s.precio)}
                          </span>
                        </span>
                        {s.id === valor ? (
                          <Check
                            className="h-5 w-5 shrink-0 text-ac-laguna"
                            aria-hidden="true"
                          />
                        ) : null}
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          ))
        )}
      </Hoja>
    </>
  );
}
