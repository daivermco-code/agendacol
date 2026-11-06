"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import Link from "next/link";
import { differenceInYears, parseISO } from "date-fns";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Campo } from "@/shared/components/campo";
import { CampoTelefono } from "@/shared/components/campo-telefono";
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
import { guardarCliente } from "../actions";
import type { ClienteResumen, DatosCliente } from "../schemas";

type Clave = keyof Omit<DatosCliente, "id">;
type Errores = Partial<Record<Clave, string>>;

const SELECTOR =
  "h-11 w-full md:h-9 rounded-md border border-input bg-ac-papel px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

function Bloque({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-3 rounded-lg border border-ac-borde p-4">
      <legend className="px-1 text-sm font-semibold">{titulo}</legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function edad(fecha: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return "";
  const anos = differenceInYears(new Date(), parseISO(fecha));
  return anos >= 0 && anos < 130 ? `${anos} años` : "";
}

/** Parecidos encontrados al crear: abrir el que ya existe o crear igual. */
function Parecidos({
  lista,
  guardando,
  onCrearIgual,
}: {
  lista: ClienteResumen[];
  guardando: boolean;
  onCrearIgual: () => void;
}) {
  return (
    <div
      className="space-y-2 rounded-lg border border-ac-aviso/40 bg-ac-aviso/10 p-3"
      role="alert"
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Users className="h-4 w-4" aria-hidden="true" /> Ya existe alguien con
        esos datos
      </p>
      <ul className="space-y-1.5">
        {lista.map((c) => (
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
            <Button asChild size="sm" variant="outline">
              <Link href={`/clientes/${c.id}`}>Abrir</Link>
            </Button>
          </li>
        ))}
      </ul>
      <Button
        size="sm"
        variant="ghost"
        disabled={guardando}
        onClick={onCrearIgual}
      >
        No es ninguno, crear nuevo
      </Button>
    </div>
  );
}

/** Nuevo o editar cliente: información personal y contacto (flujos.md §2). */
export function ModalCliente({
  inicial,
  onCerrar,
  onGuardado,
}: {
  inicial: DatosCliente;
  onCerrar: () => void;
  onGuardado?: (c: ClienteResumen) => void;
}) {
  const [d, setD] = useState<DatosCliente>(inicial);
  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState<string | null>(null);
  const [parecidos, setParecidos] = useState<ClienteResumen[]>([]);
  const [guardando, iniciar] = useTransicionRed();

  const poner = (clave: Clave, valor: string) => {
    setD((x) => ({ ...x, [clave]: valor }));
    setErrores((e) => ({ ...e, [clave]: undefined }));
    setParecidos([]);
  };

  function guardar(crearIgual = false) {
    setError(null);
    iniciar(async () => {
      const r = await guardarCliente(d, crearIgual);
      if (r.ok) {
        toast.success(d.id ? "Cliente actualizado" : "Cliente creado");
        onGuardado?.(r.cliente);
        return onCerrar();
      }
      if ("duplicados" in r) return setParecidos(r.duplicados);
      if (r.campo) {
        setErrores({ [r.campo]: r.error });
        document.getElementById(`cliente-${r.campo}`)?.focus();
      } else setError(r.error);
    });
  }

  const texto = (clave: Clave, etiqueta: string, extra?: object) => (
    <Campo
      id={`cliente-${clave}`}
      etiqueta={etiqueta}
      obligatorio={clave === "nombre" || clave === "apellido"}
      error={errores[clave]}
    >
      <Input
        id={`cliente-${clave}`}
        value={d[clave]}
        autoComplete="off"
        aria-invalid={errores[clave] ? true : undefined}
        onChange={(e) => poner(clave, e.target.value)}
        {...extra}
      />
    </Campo>
  );

  return (
    <Dialog open onOpenChange={(v) => !v && !guardando && onCerrar()}>
      <DialogContent className="h-dvh max-h-dvh max-w-full rounded-none sm:rounded-none overflow-y-auto md:h-auto md:max-h-[92dvh] md:max-w-2xl md:rounded-lg">
        <DialogHeader>
          <DialogTitle>{d.id ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
          <DialogDescription>
            Sin correo ni teléfono se crea igual, pero no recibe avisos.
          </DialogDescription>
        </DialogHeader>
        {parecidos.length ? (
          <Parecidos
            lista={parecidos}
            guardando={guardando}
            onCrearIgual={() => guardar(true)}
          />
        ) : null}
        <Bloque titulo="Información personal">
          {texto("nombre", "Nombre")}
          {texto("apellido", "Apellido")}
          <Campo
            id="cliente-fechaNacimiento"
            etiqueta="Fecha de nacimiento"
            error={errores.fechaNacimiento}
            ayuda={edad(d.fechaNacimiento) || undefined}
          >
            <Input
              id="cliente-fechaNacimiento"
              type="date"
              value={d.fechaNacimiento}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => poner("fechaNacimiento", e.target.value)}
            />
          </Campo>
          {texto("documento", "Documento de identidad")}
          <Campo id="cliente-genero" etiqueta="Género">
            <select
              id="cliente-genero"
              className={SELECTOR}
              value={d.genero}
              onChange={(e) => poner("genero", e.target.value)}
            >
              <option value="">Sin indicar</option>
              <option value="femenino">Femenino</option>
              <option value="masculino">Masculino</option>
              <option value="otro">Otro</option>
            </select>
          </Campo>
          {texto("numeroCliente", "Número de cliente")}
        </Bloque>
        <Bloque titulo="Contacto">
          {texto("correo", "Correo", { type: "email" })}
          <Campo
            id="cliente-telefono"
            etiqueta="Teléfono"
            error={errores.telefono}
          >
            <CampoTelefono
              id="cliente-telefono"
              valor={d.telefono}
              invalido={Boolean(errores.telefono)}
              onCambio={(v) => poner("telefono", v)}
            />
          </Campo>
          {texto("direccion", "Dirección")}
          {texto("barrio", "Barrio")}
          {texto("municipio", "Municipio")}
        </Bloque>
        {error ? (
          <p role="alert" className="text-sm text-ac-error">
            {error}
          </p>
        ) : null}
        <DialogFooter className="gap-2">
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
            {d.id ? "Guardar cambios" : "Crear cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
