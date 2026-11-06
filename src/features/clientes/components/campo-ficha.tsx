"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { AlertCircle, Loader2, Pencil } from "lucide-react";
import { CampoTelefono } from "@/shared/components/campo-telefono";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

export type TipoCampo = "texto" | "correo" | "telefono" | "fecha" | "genero";

const GENEROS = [
  { valor: "", nombre: "Sin dato" },
  { valor: "femenino", nombre: "Femenino" },
  { valor: "masculino", nombre: "Masculino" },
  { valor: "otro", nombre: "Otro" },
];

const SELECTOR =
  "h-11 w-full rounded-md border border-input bg-ac-papel px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring";

interface Props {
  id: string;
  etiqueta: string;
  /** Lo que se edita ("+573001234567", "2001-05-20"). */
  valor: string;
  /** Cómo se lee ("+57 300 123 4567", "20 de mayo de 2001 · 25 años"); si falta, el valor. */
  mostrar?: string | null;
  tipo?: TipoCampo;
  maximo?: number;
  hoy?: string;
  editable: boolean;
  editando: boolean;
  onEditando: (si: boolean) => void;
  /** Guarda y devuelve el error para mostrar, o `null` si salió bien. */
  onGuardar: (valor: string) => Promise<string | null>;
}

function Control({
  p,
  borrador,
  setBorrador,
  invalido,
}: {
  p: Props;
  borrador: string;
  setBorrador: (v: string) => void;
  invalido: boolean;
}) {
  const comunes = {
    id: p.id,
    "aria-invalid": invalido || undefined,
    "aria-describedby": invalido ? `${p.id}-error` : undefined,
  };
  if (p.tipo === "telefono")
    return (
      <CampoTelefono
        id={p.id}
        valor={borrador}
        onCambio={setBorrador}
        invalido={invalido}
      />
    );
  if (p.tipo === "genero")
    return (
      <select
        {...comunes}
        value={borrador}
        onChange={(e) => setBorrador(e.target.value)}
        className={SELECTOR}
      >
        {GENEROS.map((g) => (
          <option key={g.valor} value={g.valor}>
            {g.nombre}
          </option>
        ))}
      </select>
    );
  return (
    <Input
      {...comunes}
      type={
        p.tipo === "fecha" ? "date" : p.tipo === "correo" ? "email" : "text"
      }
      inputMode={p.tipo === "correo" ? "email" : undefined}
      max={p.tipo === "fecha" ? p.hoy : undefined}
      maxLength={p.maximo}
      autoComplete="off"
      value={borrador}
      onChange={(e) => setBorrador(e.target.value)}
    />
  );
}

/**
 * Un dato de la ficha del cliente en el celular: etiqueta, valor (o "Toca para llenar") y lápiz. Al tocarlo se
 * edita ahí mismo con Guardar y Cancelar; Escape cancela.
 */
export function CampoFicha(p: Props) {
  const [borrador, setBorrador] = useState(p.valor);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransicionRed();
  const boton = useRef<HTMLButtonElement>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const antes = useRef(p.editando);
  const texto = p.mostrar ?? p.valor;
  const vacio = p.editable ? "Toca para llenar" : "Sin dato";

  // Al abrir, el foco va al control; al cerrar, vuelve a la fila.
  useEffect(() => {
    if (p.editando && !antes.current)
      formulario.current
        ?.querySelector<HTMLElement>(`#${CSS.escape(p.id)}`)
        ?.focus();
    // Si el foco ya está en otro campo que se abrió (se abre uno a la vez), no se lo quita.
    if (
      !p.editando &&
      antes.current &&
      (!document.activeElement || document.activeElement === document.body)
    )
      boton.current?.focus();
    antes.current = p.editando;
  }, [p.editando, p.id]);

  function abrir() {
    setBorrador(p.valor);
    setError(null);
    p.onEditando(true);
  }

  function guardar(e: FormEvent) {
    e.preventDefault();
    if (borrador === p.valor) return p.onEditando(false);
    iniciar(async () => {
      const fallo = await p.onGuardar(borrador);
      if (!fallo) return p.onEditando(false);
      setError(fallo);
      // "Guardar" se apagó con el foco encima: vuelve al dato marcado con el error.
      requestAnimationFrame(() =>
        formulario.current
          ?.querySelector<HTMLElement>(`#${CSS.escape(p.id)}`)
          ?.focus(),
      );
    });
  }

  function teclas(e: KeyboardEvent) {
    if (e.key !== "Escape" || guardando) return;
    e.preventDefault();
    p.onEditando(false);
  }

  if (p.editando)
    return (
      <li>
        <form
          ref={formulario}
          noValidate
          data-guardando={guardando || undefined}
          onSubmit={guardar}
          onKeyDown={teclas}
          className="space-y-2 px-4 py-3"
        >
          <label htmlFor={p.id} className="block text-[13px] text-ac-pizarra">
            {p.etiqueta}
          </label>
          <Control
            p={p}
            borrador={borrador}
            setBorrador={(v) => {
              setBorrador(v);
              setError(null);
            }}
            invalido={error !== null}
          />
          {error ? (
            <p
              id={`${p.id}-error`}
              role="alert"
              className="flex items-center gap-1 text-sm text-ac-error"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={guardando}
              onClick={() => p.onEditando(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              Guardar
            </Button>
          </div>
        </form>
      </li>
    );

  const contenido = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-ac-pizarra">{p.etiqueta}</span>
        <span
          className={cn(
            "block break-words text-[16px]",
            texto ? "text-ac-tinta" : "italic text-ac-neblina",
          )}
        >
          {texto || vacio}
        </span>
      </span>
      {p.editable ? (
        <Pencil
          className="h-5 w-5 shrink-0 text-ac-pizarra"
          aria-hidden="true"
        />
      ) : null}
    </>
  );
  return (
    <li>
      {p.editable ? (
        <button
          ref={boton}
          type="button"
          onClick={abrir}
          aria-label={`${p.etiqueta}: ${texto || vacio}. Editar`}
          className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-ac-niebla active:bg-ac-laguna-claro"
        >
          {contenido}
        </button>
      ) : (
        <div className="flex min-h-16 items-center gap-3 px-4 py-2.5">
          {contenido}
        </div>
      )}
    </li>
  );
}
