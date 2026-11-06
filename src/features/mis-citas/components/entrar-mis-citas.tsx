"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { useRouter } from "next/navigation";
import { ExternalLink, KeyRound, Loader2, Send } from "lucide-react";
import { Campo } from "@/shared/components/campo";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { entrarConCodigo, pedirCodigo } from "../actions";

interface Enviado {
  destino: string;
  canal: "correo" | "whatsapp";
}

/** Entrada sin contraseña: correo o celular → código de 6 números (en la demo llega al buzón) → sus citas. */
export function EntrarMisCitas({ slug }: { slug: string }) {
  const router = useRouter();
  const [dato, setDato] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enviado, setEnviado] = useState<Enviado | null>(null);
  const [error, setError] = useState<{ campo: string; texto: string } | null>(
    null,
  );
  const [ocupado, iniciar] = useTransicionRed();

  function enviarCodigo(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await pedirCodigo({ slug, dato });
      if (!r.ok) {
        setError({ campo: "dato", texto: r.error });
        return;
      }
      setEnviado(r.datos);
      setCodigo("");
    });
  }

  function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await entrarConCodigo({ slug, dato, codigo });
      if (r.ok) router.refresh();
      else setError({ campo: r.campo ?? "codigo", texto: r.error });
    });
  }

  if (!enviado) {
    return (
      <form
        onSubmit={enviarCodigo}
        noValidate
        className="space-y-4 rounded-lg border border-ac-borde bg-ac-papel p-4 sm:p-5"
      >
        <Campo
          id="mis-dato"
          etiqueta="Correo o celular"
          error={error?.campo === "dato" ? error.texto : undefined}
          ayuda="El mismo que diste al reservar."
        >
          <Input
            id="mis-dato"
            autoComplete="email"
            value={dato}
            onChange={(e) => setDato(e.target.value)}
            aria-invalid={error?.campo === "dato"}
            disabled={ocupado}
          />
        </Campo>
        <Button type="submit" disabled={ocupado} className="w-full sm:w-auto">
          {ocupado ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Send aria-hidden="true" />
          )}
          Enviarme un código
        </Button>
      </form>
    );
  }

  return (
    <form
      onSubmit={entrar}
      noValidate
      className="space-y-4 rounded-lg border border-ac-borde bg-ac-papel p-4 sm:p-5"
    >
      <div className="space-y-1 text-sm">
        <p>
          Si tus datos están en este negocio, te llegó un código de 6 números
          {enviado.canal === "correo" ? " al correo " : " por WhatsApp al "}
          <span className="font-semibold">{enviado.destino}</span>. Vence en 10
          minutos.
        </p>
        <p className="text-ac-pizarra">
          En la demo no se envía nada: el código está en el{" "}
          <a
            href="/demo/buzon"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-ac-laguna hover:underline"
          >
            buzón de la demo
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
          .
        </p>
      </div>
      <Campo
        id="mis-codigo"
        etiqueta="Código"
        error={error?.campo !== "dato" ? error?.texto : undefined}
      >
        <Input
          id="mis-codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
          aria-invalid={!!error && error.campo !== "dato"}
          disabled={ocupado}
          className="max-w-40 text-lg tracking-[0.3em]"
          autoFocus
        />
      </Campo>
      {error?.campo === "dato" ? (
        <p className="text-xs text-ac-error">{error.texto}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={ocupado || codigo.length !== 6}>
          {ocupado ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <KeyRound aria-hidden="true" />
          )}
          Entrar
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={ocupado}
          onClick={() => enviarCodigo()}
        >
          Enviar otro código
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={ocupado}
          onClick={() => {
            setEnviado(null);
            setError(null);
          }}
        >
          Usar otro correo o celular
        </Button>
      </div>
    </form>
  );
}
