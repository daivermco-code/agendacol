"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { Loader2, Users } from "lucide-react";
import { Campo } from "@/shared/components/campo";
import { iniciales } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { guardarClienteRapido } from "../actions";
import type { ClienteResumen, DatosClienteRapido } from "../schemas";

type Errores = Partial<Record<keyof DatosClienteRapido, string>>;

const CAMPOS: {
  clave: keyof Omit<DatosClienteRapido, "id">;
  etiqueta: string;
  obligatorio?: boolean;
  tipo?: string;
  ayuda?: string;
}[] = [
  { clave: "nombre", etiqueta: "Nombre", obligatorio: true },
  { clave: "apellido", etiqueta: "Apellido", obligatorio: true },
  { clave: "correo", etiqueta: "Correo", tipo: "email" },
  {
    clave: "telefono",
    etiqueta: "Teléfono",
    tipo: "tel",
    ayuda: "Con indicativo: +57 300 123 4567",
  },
  { clave: "documento", etiqueta: "Documento" },
];

/**
 * Crear un cliente desde la reserva (o completar su contacto). Antes de crear muestra los parecidos
 * (mismo nombre, correo, teléfono o documento) para no duplicarlo.
 */
export function ClienteRapido({
  inicial,
  onListo,
  onCerrar,
}: {
  inicial: DatosClienteRapido;
  onListo: (c: ClienteResumen) => void;
  onCerrar: () => void;
}) {
  const [d, setD] = useState<DatosClienteRapido>(inicial);
  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState<string | null>(null);
  const [parecidos, setParecidos] = useState<ClienteResumen[]>([]);
  const [guardando, iniciar] = useTransicionRed();

  function guardar(crearIgual = false) {
    setError(null);
    iniciar(async () => {
      const r = await guardarClienteRapido(d, crearIgual);
      if (r.ok) return onListo(r.cliente);
      if ("duplicados" in r) return setParecidos(r.duplicados);
      if (r.campo) {
        setErrores({ [r.campo]: r.error });
        document.getElementById(`cliente-${r.campo}`)?.focus();
      } else setError(r.error);
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !guardando && onCerrar()}>
      <DialogContent className="h-dvh max-h-dvh max-w-full rounded-none sm:rounded-none overflow-y-auto md:h-auto md:max-h-[92dvh] md:max-w-md md:rounded-lg">
        <DialogHeader>
          <DialogTitle>
            {d.id ? "Completar cliente" : "Nuevo cliente"}
          </DialogTitle>
          <DialogDescription>
            Sin correo ni teléfono se crea igual, pero no recibe avisos.
          </DialogDescription>
        </DialogHeader>
        {parecidos.length ? (
          <div
            className="space-y-2 rounded-lg border border-ac-aviso/40 bg-ac-aviso/10 p-3"
            role="alert"
          >
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4" aria-hidden="true" /> Ya hay clientes
              parecidos
            </p>
            <ul className="space-y-1.5">
              {parecidos.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ac-laguna-claro text-[11px] font-bold text-ac-laguna-hondo">
                    {iniciales(c.nombre, c.apellido)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {c.nombre} {c.apellido}
                    <span className="block truncate text-xs text-ac-pizarra">
                      {[c.correo, c.telefono, c.documento]
                        .filter(Boolean)
                        .join(" · ") || "Sin contacto"}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onListo(c)}
                  >
                    Usar este
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              variant="ghost"
              disabled={guardando}
              onClick={() => guardar(true)}
            >
              No es ninguno, crear nuevo
            </Button>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {CAMPOS.map((c) => (
            <Campo
              key={c.clave}
              id={`cliente-${c.clave}`}
              etiqueta={c.etiqueta}
              obligatorio={c.obligatorio}
              error={errores[c.clave]}
              ayuda={c.ayuda}
            >
              <Input
                id={`cliente-${c.clave}`}
                type={c.tipo ?? "text"}
                value={d[c.clave]}
                autoComplete="off"
                onChange={(e) => {
                  setD((x) => ({ ...x, [c.clave]: e.target.value }));
                  setParecidos([]);
                }}
              />
            </Campo>
          ))}
        </div>
        {error ? (
          <p role="alert" className="text-sm text-ac-error">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            onClick={() => guardar(false)}
            disabled={guardando || parecidos.length > 0}
          >
            {guardando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {d.id ? "Guardar" : "Crear cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
