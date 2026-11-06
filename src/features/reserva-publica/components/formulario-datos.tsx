"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Campo } from "@/shared/components/campo";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { reservar } from "../actions";
import { enlacePaso, expandir, type Seleccion } from "../lib/seleccion";
import { esquemaDatosCliente, type DatosCliente } from "../schemas";

/** Lo que se escribe en el formulario (la casilla empieza sin marcar; Zod exige que esté marcada). */
type Formulario = Omit<DatosCliente, "autoriza"> & { autoriza: boolean };
type Clave = keyof Formulario;
type Errores = Partial<Record<Clave, string>>;

const CAMPOS: {
  clave: Exclude<Clave, "nota" | "autoriza">;
  etiqueta: string;
  tipo?: string;
  auto: string;
  ayuda?: string;
}[] = [
  { clave: "nombre", etiqueta: "Nombre", auto: "given-name" },
  { clave: "apellido", etiqueta: "Apellido", auto: "family-name" },
  { clave: "correo", etiqueta: "Correo", tipo: "email", auto: "email" },
  {
    clave: "telefono",
    etiqueta: "Teléfono",
    tipo: "tel",
    auto: "tel",
    ayuda: "Con indicativo: +57 300 123 4567",
  },
];

const VACIO: Formulario = {
  nombre: "",
  apellido: "",
  correo: "",
  telefono: "",
  nota: "",
  autoriza: false,
};

/** Paso 3: datos de contacto y "Agendar". Si la hora se ocupó mientras tanto, ofrece volver a elegir. */
export function FormularioDatos({
  slug,
  seleccion,
}: {
  slug: string;
  seleccion: Seleccion;
}) {
  const router = useRouter();
  const [d, setD] = useState<Formulario>(VACIO);
  const [errores, setErrores] = useState<Errores>({});
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [enviando, iniciar] = useTransicionRed();

  function cambiar<K extends Clave>(clave: K, valor: Formulario[K]) {
    setD((x) => ({ ...x, [clave]: valor }));
    if (errores[clave]) setErrores((e) => ({ ...e, [clave]: undefined }));
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setOcupada(null);
    const p = esquemaDatosCliente.safeParse(d);
    if (!p.success) {
      const nuevos: Errores = {};
      for (const i of p.error.issues) nuevos[i.path[0] as Clave] ??= i.message;
      setErrores(nuevos);
      document.getElementById(`datos-${Object.keys(nuevos)[0]}`)?.focus();
      return;
    }
    iniciar(async () => {
      const r = await reservar({
        ...d,
        slug,
        servicios: expandir(seleccion.lineas),
        profesionalId: seleccion.profesionalId,
        fecha: seleccion.fecha,
        hora: seleccion.hora,
      });
      if (r.ok) {
        router.push(`/cita/${r.datos.token}?nueva=1`);
        return;
      }
      if (r.code === "OCUPADA" || r.code === "CLIENTE_OCUPADO")
        setOcupada(r.error);
      else if (r.campo && r.campo in VACIO) {
        setErrores({ [r.campo]: r.error });
        document.getElementById(`datos-${r.campo}`)?.focus();
      } else toast.error(r.error, { duration: 8000 });
    });
  }

  return (
    <form
      onSubmit={enviar}
      noValidate
      className="space-y-4 rounded-lg border border-ac-borde bg-ac-papel p-4 sm:p-5"
    >
      {ocupada ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-md border border-amber-200 dark:border-ac-aviso/30 bg-ac-aviso-fondo p-3 text-ac-demo-texto sm:flex-row sm:items-center"
        >
          <p className="flex flex-1 items-start gap-2">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            {ocupada}
          </p>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="shrink-0 bg-ac-papel"
          >
            <Link href={enlacePaso(slug, "hora", { ...seleccion, hora: null })}>
              Elegir otra hora
            </Link>
          </Button>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {CAMPOS.map((c) => (
          <Campo
            key={c.clave}
            id={`datos-${c.clave}`}
            etiqueta={c.etiqueta}
            obligatorio
            error={errores[c.clave]}
            ayuda={c.ayuda}
          >
            <Input
              id={`datos-${c.clave}`}
              type={c.tipo ?? "text"}
              autoComplete={c.auto}
              value={d[c.clave]}
              onChange={(e) => cambiar(c.clave, e.target.value)}
              aria-invalid={!!errores[c.clave]}
              aria-describedby={
                errores[c.clave] ? `datos-${c.clave}-error` : undefined
              }
              disabled={enviando}
            />
          </Campo>
        ))}
      </div>
      <Campo
        id="datos-nota"
        etiqueta="Observaciones"
        error={errores.nota}
        ayuda="Algo que el negocio deba saber (opcional)"
      >
        <Textarea
          id="datos-nota"
          rows={3}
          maxLength={500}
          value={d.nota}
          onChange={(e) => cambiar("nota", e.target.value)}
          disabled={enviando}
        />
      </Campo>
      <div className="space-y-1.5">
        <div className="flex items-start gap-2.5">
          <Checkbox
            id="datos-autoriza"
            checked={d.autoriza === true}
            onCheckedChange={(v) => cambiar("autoriza", v === true)}
            aria-invalid={!!errores.autoriza}
            disabled={enviando}
            className="mt-0.5"
          />
          <Label htmlFor="datos-autoriza" className="font-normal leading-snug">
            Autorizo a este negocio a usar mis datos para gestionar mi reserva y
            enviarme sus avisos.
          </Label>
        </div>
        {errores.autoriza ? (
          <p id="datos-autoriza-error" className="text-xs text-ac-error">
            {errores.autoriza}
          </p>
        ) : null}
      </div>
      <Button
        type="submit"
        size="lg"
        className="w-full sm:w-auto sm:min-w-44"
        disabled={enviando}
      >
        {enviando ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <CalendarCheck aria-hidden="true" />
        )}
        {enviando ? "Agendando…" : "Agendar"}
      </Button>
    </form>
  );
}
