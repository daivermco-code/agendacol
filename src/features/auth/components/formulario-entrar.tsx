"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2 } from "lucide-react";
import { entrar, entrarComo } from "@/features/auth/actions";
import { USUARIOS_DEMO, type ClaveDemo } from "@/features/auth/demo";
import { esquemaEntrar, type DatosEntrar } from "@/features/auth/schemas";
import { NOMBRE_ROL } from "@/shared/lib/permisos";
import { iniciales } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

function ErrorCampo({ id, mensaje }: { id: string; mensaje?: string }) {
  if (!mensaje) return null;
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1 text-xs text-ac-error">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {mensaje}
    </p>
  );
}

export function FormularioEntrar({ volver }: { volver?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransicionRed();
  const [comoQuien, setComoQuien] = useState<ClaveDemo | null>(null);
  const {
    register,
    handleSubmit,
    setError: marcarCampo,
    formState: { errors },
  } = useForm<DatosEntrar>({
    resolver: zodResolver(esquemaEntrar),
    mode: "onTouched",
  });

  const ocupado = enviando || comoQuien !== null;
  const profesionales = USUARIOS_DEMO.filter((u) => u.rol === "profesional");

  const alEnviar = handleSubmit((datos) => {
    setError(null);
    iniciar(async () => {
      const r = await entrar(datos, volver);
      if (r && !r.ok) {
        if (r.campo && r.error !== "El correo o la contraseña no coinciden") {
          marcarCampo(r.campo, { message: r.error }, { shouldFocus: true });
        } else setError(r.error);
      }
    });
  });

  async function alEntrarComo(clave: ClaveDemo) {
    setError(null);
    setComoQuien(clave);
    const r = await entrarComo(clave, volver);
    if (r && !r.ok) {
      setError(r.error);
      setComoQuien(null);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={alEnviar} noValidate className="space-y-4">
        <div>
          <Label htmlFor="correo">Correo</Label>
          <Input
            id="correo"
            type="email"
            autoComplete="username"
            inputMode="email"
            className="mt-1.5 md:h-10"
            aria-invalid={errors.correo ? true : undefined}
            aria-describedby={errors.correo ? "correo-error" : undefined}
            {...register("correo")}
          />
          <ErrorCampo id="correo-error" mensaje={errors.correo?.message} />
        </div>
        <div>
          <Label htmlFor="clave">Contraseña</Label>
          <Input
            id="clave"
            type="password"
            autoComplete="current-password"
            className="mt-1.5 md:h-10"
            aria-invalid={errors.clave ? true : undefined}
            aria-describedby={errors.clave ? "clave-error" : undefined}
            {...register("clave")}
          />
          <ErrorCampo id="clave-error" mensaje={errors.clave?.message} />
        </div>
        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md bg-ac-error-fondo px-3 py-2 text-sm text-ac-error"
          >
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          className="w-full text-[15px] md:h-10"
          disabled={ocupado}
        >
          {enviando ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : null}
          Entrar
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-ac-neblina">
        <span className="h-px flex-1 bg-ac-borde" />o entra a la demo como
        <span className="h-px flex-1 bg-ac-borde" />
      </div>

      <ul className="space-y-2">
        {USUARIOS_DEMO.filter((u) => u.rol !== "profesional").map((u) => (
          <li key={u.clave}>
            <button
              type="button"
              onClick={() => alEntrarComo(u.clave)}
              disabled={ocupado}
              className="flex w-full items-center gap-3 rounded-lg border border-ac-borde bg-ac-papel px-3 py-2.5 text-left transition-colors hover:border-ac-borde-fuerte hover:bg-ac-niebla disabled:opacity-60"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ac-laguna-claro text-[13px] font-bold text-ac-laguna-hondo">
                {iniciales(u.nombre)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {NOMBRE_ROL[u.rol]}{" "}
                  <span className="font-normal text-ac-pizarra">
                    · {u.nombre}
                  </span>
                </span>
                <span className="block text-[13px] text-ac-pizarra">
                  {u.descripcion}
                </span>
              </span>
              {comoQuien === u.clave ? (
                <Loader2
                  className="h-4 w-4 animate-spin text-ac-laguna"
                  aria-label="Entrando"
                />
              ) : null}
            </button>
          </li>
        ))}
        <li className="rounded-lg border border-ac-borde bg-ac-papel px-3 py-2.5">
          <p className="font-semibold">
            {NOMBRE_ROL.profesional}{" "}
            <span className="font-normal text-ac-pizarra">
              · elige quién eres
            </span>
          </p>
          <p className="text-[13px] text-ac-pizarra">
            Solo su agenda y sus citas
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {profesionales.map((u) => (
              <button
                key={u.clave}
                type="button"
                onClick={() => alEntrarComo(u.clave)}
                disabled={ocupado}
                className="flex flex-col items-center gap-1 rounded-md border border-ac-borde px-2 py-2 text-[13px] transition-colors hover:border-ac-borde-fuerte hover:bg-ac-niebla disabled:opacity-60"
              >
                <span
                  aria-hidden="true"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ac-laguna-claro text-[12px] font-bold text-ac-laguna-hondo"
                >
                  {comoQuien === u.clave ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    iniciales(u.nombre)
                  )}
                </span>
                <span>
                  <span className="sr-only">{NOMBRE_ROL.profesional} · </span>
                  {u.nombre.split(" ")[0]}
                  <span className="sr-only">
                    {u.nombre.slice(u.nombre.indexOf(" "))}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </li>
      </ul>
    </div>
  );
}
