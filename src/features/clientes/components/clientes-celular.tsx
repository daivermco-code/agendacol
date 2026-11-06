"use client";

import { useEffect, useRef, useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search, Users } from "lucide-react";
import { usePuede } from "@/features/auth/components/proveedor-miembro";
import { Vacio } from "@/shared/components/vacio";
import { cn, iniciales } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { masClientesCelular } from "../actions";
import {
  agruparPorLetra,
  colorDe,
  type ClienteLista,
} from "../lib/lista-celular";
import { CLIENTE_VACIO } from "../schemas";
import { HojaCliente } from "./hoja-cliente";
import { ModalCliente } from "./modal-cliente";

const POR_PAGINA = 100;

interface Props {
  q: string;
  /** Primera página (100 por nombre); `"error"` si la consulta falló. */
  inicial: { filas: ClienteLista[]; total: number } | "error";
}

function FilaCliente({ c, onAbrir }: { c: ClienteLista; onAbrir: () => void }) {
  const color = colorDe(c.id);
  return (
    <li>
      <button
        type="button"
        onClick={onAbrir}
        className="flex min-h-16 w-full items-center gap-4 py-2 text-left hover:bg-ac-niebla active:bg-ac-laguna-claro"
      >
        <span
          aria-hidden="true"
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[16px] font-bold"
          style={{ background: color.fondo, color: color.texto }}
        >
          {iniciales(c.nombre, c.apellido)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-medium">
            {c.nombre} {c.apellido}
          </span>
          {c.correo ? (
            <span className="block truncate text-[14px] text-ac-pizarra">
              {c.correo}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

/**
 * Más páginas al llegar al final (y el botón, para quien no desplaza). Vuelven a empezar con cada primera página
 * nueva (otra búsqueda o un `router.refresh` tras crear, editar o eliminar): las de antes pueden estar corridas.
 */
function useMasClientes(q: string, base: unknown, total: number) {
  const [mas, setMas] = useState({
    q,
    base,
    filas: [] as ClienteLista[],
    pagina: 1,
  });
  const [cargando, iniciar] = useTransicionRed();
  const [fallo, setFallo] = useState<string | null>(null);
  if (mas.q !== q || mas.base !== base) {
    setMas({ q, base, filas: [], pagina: 1 });
    setFallo(null);
  }
  const hayMas = mas.pagina * POR_PAGINA < total;

  function cargar() {
    if (cargando || !hayMas) return;
    const pagina = mas.pagina + 1;
    setFallo(null);
    iniciar(async () => {
      const r = await masClientesCelular(q, pagina);
      if (!r.ok) return setFallo(q);
      setMas((m) =>
        m.q === q && m.base === base && m.pagina === pagina - 1
          ? { ...m, filas: [...m.filas, ...r.filas], pagina }
          : m,
      );
    });
  }
  return { filas: mas.filas, hayMas, cargando, fallo: fallo === q, cargar };
}

/**
 * Clientes en el celular (T-12.12): título, búsqueda y la lista A–Z con letras de sección; cada fila abre la
 * ficha en una hoja. El botón flotante crea un cliente y abre su ficha.
 */
export function ClientesCelular({ q, inicial }: Props) {
  const router = useRouter();
  const puedo = usePuede();
  const [texto, setTexto] = useState(q);
  const [qVisto, setQVisto] = useState(q);
  // Lo último que esta caja pidió buscar: cuando llega, no se le devuelve a la caja (quizá ya se borró).
  const [pedido, setPedido] = useState<string | null>(null);
  const [buscando, iniciarBusqueda] = useTransicionRed();
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const total = inicial === "error" ? 0 : inicial.total;
  const mas = useMasClientes(q, inicial, total);
  const centinela = useRef<HTMLDivElement>(null);
  const busqueda = useRef<HTMLInputElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const botonNuevo = useRef<HTMLButtonElement>(null);
  // La hoja abierta tras crear un cliente: al cerrarla, el foco vuelve al botón flotante (la ventana ya no está).
  const desdeNuevo = useRef(false);
  const cargar = useRef(mas.cargar);
  useEffect(() => {
    cargar.current = mas.cargar;
  });

  // Con Atrás del navegador cambia `q` sin escribir: la caja lo sigue (si no se está escribiendo otra cosa).
  if (qVisto !== q) {
    setQVisto(q);
    if (q === pedido) setPedido(null);
    else if (texto.trim() === qVisto) setTexto(q);
  }

  function buscarYa(v: string) {
    setPedido(v);
    iniciarBusqueda(() =>
      router.replace(v ? `/clientes?q=${encodeURIComponent(v)}` : "/clientes", {
        scroll: false,
      }),
    );
  }

  // Busca tras una pausa al escribir.
  useEffect(() => {
    const v = texto.trim();
    if (v === q) return;
    const t = window.setTimeout(() => buscarYa(v), 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  useEffect(() => {
    const el = centinela.current;
    if (!el || !mas.hayMas) return;
    const io = new IntersectionObserver(
      ([e]) => e?.isIntersecting && cargar.current(),
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mas.hayMas]);

  const vistos = new Set<string>();
  const filas = [
    ...(inicial === "error" ? [] : inicial.filas),
    ...mas.filas,
  ].filter((c) => !vistos.has(c.id) && Boolean(vistos.add(c.id)));
  const grupos = agruparPorLetra(filas);

  return (
    <main className="px-4 pb-24 pt-1 md:hidden">
      <h1
        ref={titulo}
        tabIndex={-1}
        className="text-[28px] font-bold leading-tight focus:outline-none"
      >
        Clientes
      </h1>
      <form
        role="search"
        onSubmit={(e) => {
          // «Buscar» del teclado: busca ya y lo cierra.
          e.preventDefault();
          const v = texto.trim();
          if (v !== q) buscarYa(v);
          busqueda.current?.blur();
        }}
        className="relative mt-3"
      >
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ac-neblina"
          aria-hidden="true"
        />
        <Input
          ref={busqueda}
          type="search"
          aria-label="Buscar clientes"
          placeholder="Buscar clientes"
          value={texto}
          maxLength={60}
          onChange={(e) => setTexto(e.target.value)}
          className="h-12 rounded-xl bg-ac-niebla pl-12 text-[16px]"
        />
      </form>

      {inicial === "error" ? (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-ac-niebla px-4 py-3 text-sm text-ac-error"
        >
          No pudimos cargar los clientes. Intenta de nuevo en un momento.
        </p>
      ) : (
        <>
          <p role="status" className="mt-2 text-sm text-ac-pizarra">
            {total} {total === 1 ? "cliente" : "clientes"}
            {q ? ` para «${q}»` : ""}
          </p>
          <div
            aria-busy={buscando}
            className={cn("transition-opacity", buscando && "opacity-60")}
          >
            {total === 0 ? (
              q ? (
                <Vacio
                  icono={Search}
                  titulo={`Nadie coincide con «${q}»`}
                  texto="Busca por nombre, apellido, documento, correo o teléfono."
                />
              ) : (
                <Vacio
                  icono={Users}
                  titulo="Aún no tienes clientes"
                  texto="Crea el primero o agrégalo desde una reserva."
                />
              )
            ) : (
              grupos.map((g) => {
                const idLetra = `letra-${g.letra === "#" ? "otros" : g.letra}`;
                return (
                  <section key={g.letra}>
                    <h2
                      id={idLetra}
                      className="pb-1 pt-4 text-[15px] font-semibold text-ac-pizarra"
                    >
                      {g.letra}
                    </h2>
                    <ul>
                      {g.clientes.map((c) => (
                        <FilaCliente
                          key={c.id}
                          c={c}
                          onAbrir={() => {
                            desdeNuevo.current = false;
                            setAbierto(c.id);
                          }}
                        />
                      ))}
                    </ul>
                  </section>
                );
              })
            )}
          </div>
          {mas.hayMas ? (
            <div ref={centinela} className="mt-4 space-y-2">
              <Button
                variant="outline"
                className="w-full rounded-full"
                disabled={mas.cargando}
                onClick={mas.cargar}
              >
                {mas.cargando ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : null}
                Ver más clientes
              </Button>
              {mas.fallo ? (
                <p role="alert" className="text-center text-sm text-ac-error">
                  No pudimos cargar más clientes. Toca para intentar de nuevo.
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {puedo("editar_clientes") ? (
        <button
          ref={botonNuevo}
          type="button"
          onClick={() => setNuevo(true)}
          className="fixed bottom-[var(--alto-pestanas)] right-4 z-30 inline-flex h-14 items-center gap-2 rounded-full bg-ac-laguna px-5 text-[15px] font-semibold text-ac-papel shadow-flota hover:bg-ac-laguna-hondo md:hidden print:hidden"
        >
          <Plus className="h-5 w-5" aria-hidden="true" /> Nuevo cliente
        </button>
      ) : null}
      {abierto ? (
        <HojaCliente
          id={abierto}
          version={inicial}
          onCerrar={() => setAbierto(null)}
          // Tras eliminar, al título: enfocar la búsqueda abriría el teclado en Android.
          volverA={(borrado) =>
            borrado
              ? titulo.current
              : desdeNuevo.current
                ? botonNuevo.current
                : null
          }
        />
      ) : null}
      {nuevo ? (
        <ModalCliente
          inicial={CLIENTE_VACIO}
          onCerrar={() => setNuevo(false)}
          onGuardado={(c) => {
            desdeNuevo.current = true;
            router.refresh();
            setAbierto(c.id);
          }}
        />
      ) : null}
    </main>
  );
}
