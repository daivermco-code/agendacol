"use client";

import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import Link from "next/link";
import {
  Copy,
  Download,
  ExternalLink,
  LifeBuoy,
  LogOut,
  MessageCircle,
  Settings,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useMiembro } from "@/features/auth/components/proveedor-miembro";
import { entrarComo, salir } from "@/features/auth/actions";
import { USUARIOS_DEMO } from "@/features/auth/demo";
import { useInstalarApp } from "@/shared/lib/instalar-app";
import { NOMBRE_ROL } from "@/shared/lib/permisos";
import { cn, iniciales } from "@/shared/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import type { OpcionMenu } from "./menu";

const BOTON_REDONDO =
  "inline-flex h-9 w-9 items-center justify-center rounded-full text-ac-sobre-noche hover:bg-ac-noche-claro focus-visible:outline-offset-0";

/** "Reservas en línea": punto verde y desplegable con el enlace del sitio público. */
export function MenuReservasEnLinea({
  compacto = false,
}: {
  compacto?: boolean;
}) {
  const { negocioSlug } = useMiembro();
  const ruta = `/reservar/${negocioSlug}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${ruta}`);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-11 md:h-9 items-center gap-2 rounded-md border border-white/20 px-3 text-[13px] font-semibold text-ac-sobre-noche hover:bg-ac-noche-claro",
          compacto &&
            "w-full justify-center border-ac-borde text-ac-tinta hover:bg-ac-niebla",
        )}
      >
        <span className="h-2 w-2 rounded-full bg-ac-exito" aria-hidden="true" />
        Reservas en línea
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-xs text-ac-pizarra">
            Tu sitio de reservas está activo
          </span>
          <span className="block truncate font-semibold">{ruta}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={ruta} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden="true" /> Abrir el sitio
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={copiar}>
          <Copy aria-hidden="true" /> Copiar enlace
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            toast.info(
              "En la demo, WhatsApp se simula: el mensaje irá al buzón.",
            )
          }
        >
          <MessageCircle aria-hidden="true" /> Compartir por WhatsApp
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MenuEngranaje({ opciones }: { opciones: OpcionMenu[] }) {
  if (opciones.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={BOTON_REDONDO} aria-label="Ajustes">
        <Settings className="h-5 w-5" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {opciones.map((o) => (
          <DropdownMenuItem key={o.href} asChild>
            <Link href={o.href}>{o.nombre}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MenuUsuario() {
  const miembro = useMiembro();
  const [pendiente, iniciar] = useTransicionRed();
  const { evento: instalar, guardar } = useInstalarApp();

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
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-11 w-11 md:h-9 md:w-9 items-center justify-center rounded-full bg-ac-laguna text-[13px] font-bold text-ac-papel hover:bg-ac-laguna-hondo"
        aria-label={`${iniciales(miembro.nombre)}, menú de ${miembro.nombre}`}
        disabled={pendiente}
      >
        {iniciales(miembro.nombre)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <span className="block font-semibold">{miembro.nombre}</span>
          <span className="block truncate text-xs text-ac-pizarra">
            {miembro.correo}
          </span>
          <span className="mt-1 inline-block rounded-full bg-ac-laguna-claro px-2 py-0.5 text-xs font-semibold text-ac-laguna-hondo">
            {NOMBRE_ROL[miembro.rol]} · {miembro.negocioNombre}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/perfil">
            <UserRound aria-hidden="true" /> Mi perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Users aria-hidden="true" /> Cambiar de rol
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-60">
            {USUARIOS_DEMO.map((u) => (
              <DropdownMenuItem
                key={u.clave}
                disabled={u.correo === miembro.correo}
                onSelect={() => cambiarA(u.clave)}
              >
                <span className="flex flex-col">
                  <span className="font-semibold">{NOMBRE_ROL[u.rol]}</span>
                  <span className="text-xs text-ac-pizarra">{u.nombre}</span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem asChild>
          <Link href="/ayuda">
            <LifeBuoy aria-hidden="true" /> Ayuda
          </Link>
        </DropdownMenuItem>
        {instalar ? (
          <DropdownMenuItem onSelect={instalarApp}>
            <Download aria-hidden="true" /> Instalar la app
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => iniciar(() => salir())}>
          <LogOut aria-hidden="true" /> Salir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
