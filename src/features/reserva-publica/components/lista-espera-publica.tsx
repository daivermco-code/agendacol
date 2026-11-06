"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { BellRing, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FRANJAS, type Franja } from "@/features/lista-espera/lib/franjas";
import { Campo } from "@/shared/components/campo";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { anotarEnEspera } from "../actions";
import { fechaLarga } from "../lib/fechas-publicas";
import { esquemaEspera } from "../schemas";

type Clave = "nombre" | "apellido" | "correo" | "telefono";
type Errores = Partial<Record<Clave | "autoriza" | "franja", string>>;

const CAMPOS: { clave: Clave; etiqueta: string; tipo: string; auto: string }[] =
  [
    { clave: "nombre", etiqueta: "Nombre", tipo: "text", auto: "given-name" },
    {
      clave: "apellido",
      etiqueta: "Apellido",
      tipo: "text",
      auto: "family-name",
    },
    { clave: "correo", etiqueta: "Correo", tipo: "email", auto: "email" },
    { clave: "telefono", etiqueta: "Celular", tipo: "tel", auto: "tel" },
  ];

interface Props {
  slug: string;
  servicios: string[];
  profesional: { id: string; nombre: string } | null;
  fecha: string;
  sinHoras: boolean;
}

/** "Avísame si se libera una hora" del día elegido: datos de contacto y parte del día, a la lista de espera. */
export function ListaEsperaPublica({
  slug,
  servicios,
  profesional,
  fecha,
  sinHoras,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [anotado, setAnotado] = useState<string | null>(null);
  const [franja, setFranja] = useState<Franja>("dia");
  const [d, setD] = useState<Record<Clave, string>>({
    nombre: "",
    apellido: "",
    correo: "",
    telefono: "",
  });
  const [autoriza, setAutoriza] = useState(false);
  const [errores, setErrores] = useState<Errores>({});
  const [enviando, iniciar] = useTransicionRed();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const entrada = {
      ...d,
      autoriza,
      franja,
      slug,
      servicios,
      profesionalId: profesional?.id ?? null,
      fecha,
    };
    const p = esquemaEspera.safeParse(entrada);
    if (!p.success) {
      const nuevos: Errores = {};
      for (const i of p.error.issues)
        nuevos[i.path[0] as keyof Errores] ??= i.message;
      setErrores(nuevos);
      return;
    }
    iniciar(async () => {
      const r = await anotarEnEspera(entrada);
      if (r.ok) {
        setAbierto(false);
        setAnotado(fecha);
        toast.success("Listo: te avisaremos si se libera una hora");
      } else if (r.campo) setErrores({ [r.campo]: r.error });
      else toast.error(r.error, { duration: 8000 });
    });
  }

  if (anotado === fecha) {
    return (
      <p className="mt-3 flex items-center gap-2 text-sm text-ac-exito">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        Estás en la lista de espera del {fechaLarga(fecha).toLowerCase()}.
      </p>
    );
  }

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="text-ac-pizarra">
          {sinHoras
            ? "¿Quieres este día?"
            : "¿No ves la hora que quieres este día?"}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setErrores({});
            setAbierto(true);
          }}
        >
          <BellRing aria-hidden="true" />
          Avísame si se libera una hora
        </Button>
      </div>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Lista de espera</DialogTitle>
            <DialogDescription>
              Si alguien cancela o mueve su cita el{" "}
              {fechaLarga(fecha).toLowerCase()}
              {profesional ? ` con ${profesional.nombre}` : ""}, te avisamos por
              correo y WhatsApp con el enlace para reservar.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={enviar} noValidate className="space-y-4">
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">
                ¿A qué hora te sirve?
              </legend>
              <div className="flex flex-wrap gap-2" role="radiogroup">
                {(Object.keys(FRANJAS) as Franja[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={franja === f}
                    onClick={() => setFranja(f)}
                    className={cn(
                      "min-h-11 md:min-h-0 rounded-full border px-3.5 py-1.5 text-sm font-medium",
                      franja === f
                        ? "border-ac-laguna bg-ac-laguna-claro text-ac-laguna-hondo ring-1 ring-ac-laguna"
                        : "border-ac-borde bg-ac-papel hover:border-ac-laguna",
                    )}
                  >
                    {FRANJAS[f]}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              {CAMPOS.map((c) => (
                <Campo
                  key={c.clave}
                  id={`espera-${c.clave}`}
                  etiqueta={c.etiqueta}
                  obligatorio
                  error={errores[c.clave]}
                  ayuda={
                    c.clave === "telefono"
                      ? "Con indicativo: +57 300…"
                      : undefined
                  }
                >
                  <Input
                    id={`espera-${c.clave}`}
                    type={c.tipo}
                    autoComplete={c.auto}
                    value={d[c.clave]}
                    onChange={(e) =>
                      setD((x) => ({ ...x, [c.clave]: e.target.value }))
                    }
                    aria-invalid={!!errores[c.clave]}
                    disabled={enviando}
                  />
                </Campo>
              ))}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="espera-autoriza"
                  checked={autoriza}
                  onCheckedChange={(v) => setAutoriza(v === true)}
                  aria-invalid={!!errores.autoriza}
                  disabled={enviando}
                  className="mt-0.5"
                />
                <Label
                  htmlFor="espera-autoriza"
                  className="font-normal leading-snug"
                >
                  Autorizo a este negocio a usar mis datos para avisarme si se
                  libera una hora.
                </Label>
              </div>
              {errores.autoriza ? (
                <p className="text-xs text-ac-error">{errores.autoriza}</p>
              ) : null}
            </div>
            <Button type="submit" disabled={enviando} className="w-full">
              {enviando ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <BellRing aria-hidden="true" />
              )}
              Anotarme en la lista de espera
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
