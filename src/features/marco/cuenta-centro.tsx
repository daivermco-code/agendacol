"use client";

import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import {
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  LogOut,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useMiembro } from "@/features/auth/components/proveedor-miembro";
import { entrarComo, salir } from "@/features/auth/actions";
import { USUARIOS_DEMO } from "@/features/auth/demo";
import { useInstalarApp } from "@/shared/lib/instalar-app";
import { NOMBRE_ROL } from "@/shared/lib/permisos";
import { cn } from "@/shared/lib/utils";

const TARJETA =
  "overflow-hidden rounded-2xl border border-ac-borde bg-ac-papel";
const FILA =
  "flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-ac-niebla focus-visible:outline-offset-[-2px] disabled:opacity-60";
const CUADRITO =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-ac-niebla-oscura text-ac-pizarra";

/** Lo que en la tableta y el computador está en el menú del usuario y en "Reservas en línea". */
export function CuentaCentro({ verReservas }: { verReservas: boolean }) {
  const miembro = useMiembro();
  const [pendiente, iniciar] = useTransicionRed();
  const { evento: instalar, guardar } = useInstalarApp();
  const ruta = `/reservar/${miembro.negocioSlug}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${ruta}`);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  }

  async function instalarApp() {
    if (!instalar) return;
    await instalar.prompt();
    const { outcome } = await instalar.userChoice;
    // El aviso de Chrome sirve una sola vez.
    guardar(null);
    if (outcome === "accepted") toast.success("AgendaCol quedó instalada");
  }

  function cambiarA(clave: (typeof USUARIOS_DEMO)[number]["clave"]) {
    iniciar(async () => {
      const r = await entrarComo(clave);
      if (r && !r.ok) toast.error(r.error, { duration: Infinity });
    });
  }

  return (
    <>
      {verReservas ? (
        <section aria-labelledby="centro-reservas">
          <h2
            id="centro-reservas"
            className="mb-2 mt-6 px-1 text-[13px] font-semibold uppercase tracking-wide text-ac-neblina"
          >
            Reservas en línea
          </h2>
          <ul className={cn(TARJETA, "divide-y divide-ac-borde")}>
            <li>
              <a href={ruta} target="_blank" rel="noreferrer" className={FILA}>
                <span
                  className={cn(
                    CUADRITO,
                    "bg-ac-laguna-claro text-ac-laguna-hondo",
                  )}
                  aria-hidden="true"
                >
                  <ExternalLink className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">
                    Abrir tu sitio de reservas
                  </span>
                  <span className="block truncate text-[13px] text-ac-pizarra">
                    {ruta}
                  </span>
                </span>
              </a>
            </li>
            <li>
              <button type="button" onClick={copiar} className={FILA}>
                <span className={CUADRITO} aria-hidden="true">
                  <Copy className="h-5 w-5" />
                </span>
                <span className="flex-1 text-[15px] font-semibold">
                  Copiar el enlace
                </span>
              </button>
            </li>
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="centro-cuenta">
        <h2
          id="centro-cuenta"
          className="mb-2 mt-6 px-1 text-[13px] font-semibold uppercase tracking-wide text-ac-neblina"
        >
          Cuenta
        </h2>
        <div className={cn(TARJETA, "divide-y divide-ac-borde")}>
          <details className="group">
            <summary
              className={cn(
                FILA,
                "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
              )}
            >
              <span className={CUADRITO} aria-hidden="true">
                <Users className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">
                  Cambiar de rol
                </span>
                <span className="block text-[13px] text-ac-pizarra">
                  Entra como otro usuario de la demo.
                </span>
              </span>
              <ChevronDown
                className="h-5 w-5 shrink-0 text-ac-neblina transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <ul className="border-t border-ac-borde bg-ac-niebla/60">
              {USUARIOS_DEMO.map((u) => (
                <li key={u.clave}>
                  <button
                    type="button"
                    disabled={pendiente || u.correo === miembro.correo}
                    onClick={() => cambiarA(u.clave)}
                    className={cn(FILA, "pl-16")}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">
                        {NOMBRE_ROL[u.rol]}
                        {u.correo === miembro.correo ? " · ahora" : ""}
                      </span>
                      <span className="block text-[13px] text-ac-pizarra">
                        {u.nombre}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
          {instalar ? (
            <button type="button" onClick={instalarApp} className={FILA}>
              <span className={CUADRITO} aria-hidden="true">
                <Download className="h-5 w-5" />
              </span>
              <span className="flex-1 text-[15px] font-semibold">
                Instalar la app
              </span>
            </button>
          ) : null}
        </div>
      </section>

      <button
        type="button"
        disabled={pendiente}
        onClick={() => iniciar(() => salir())}
        className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-ac-error/40 bg-ac-papel text-[15px] font-semibold text-ac-error hover:bg-ac-error/5 disabled:opacity-60"
      >
        <LogOut className="h-5 w-5" aria-hidden="true" />
        Cerrar sesión
      </button>
    </>
  );
}
