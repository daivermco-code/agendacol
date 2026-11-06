import Link from "next/link";
import {
  Armchair,
  ArrowLeftRight,
  BellRing,
  CalendarCheck,
  ChartColumn,
  ChevronRight,
  Circle,
  Contact,
  Gift,
  HandCoins,
  Hash,
  Hourglass,
  Inbox,
  LifeBuoy,
  ListChecks,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Repeat,
  Scissors,
  Search,
  Stamp,
  Store,
  Tags,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Miembro } from "@/features/auth/services/miembro";
import { NOMBRE_ROL } from "@/shared/lib/permisos";
import { cn, iniciales } from "@/shared/lib/utils";
import { CuentaCentro } from "./cuenta-centro";
import type { GrupoCentro } from "./menu";

const ICONOS: Record<string, LucideIcon> = {
  "/ajustes/mi-negocio": Store,
  "/administracion/locales": MapPin,
  "/administracion/servicios": Scissors,
  "/administracion/profesionales": Contact,
  "/administracion/productos": Package,
  "/administracion/whatsapp": MessageCircle,
  "/administracion/planes": Repeat,
  "/administracion/recursos": Armchair,
  "/administracion/gift-cards": Gift,
  "/administracion/precios": Tags,
  "/administracion/numeracion": Hash,
  "/clientes/marketing": Mail,
  "/clientes/crece": TrendingUp,
  "/clientes/recordatorios": BellRing,
  "/clientes/fidelizacion": Stamp,
  "/clientes/lista-espera": Hourglass,
  "/ventas/transacciones": ArrowLeftRight,
  "/ventas/planes": Repeat,
  "/ventas/gift-cards": Gift,
  "/ventas/caja": Wallet,
  "/ventas/cobros": HandCoins,
  "/reportes/reservas": CalendarCheck,
  "/reportes/ventas": ChartColumn,
  "/usuarios": Users,
  "/primeros-pasos": ListChecks,
  "/demo/buzon": Inbox,
  "/buscar": Search,
  "/ayuda": LifeBuoy,
  "/perfil": UserRound,
};

/** Cuadrito de color suave de cada grupo (solo tokens de AgendaCol). */
const COLOR_GRUPO: Record<string, string> = {
  "Mi negocio": "bg-ac-laguna-claro text-ac-laguna-hondo",
  Clientes: "bg-ac-info-fondo text-ac-info",
  Ventas: "bg-ac-demo-fondo text-ac-demo-texto",
  Reportes: "bg-ac-exito/10 text-ac-exito",
  Equipo: "bg-ac-niebla-oscura text-ac-pizarra",
  Ayuda: "bg-ac-aviso/10 text-ac-aviso",
};

const TARJETA =
  "overflow-hidden rounded-2xl border border-ac-borde bg-ac-papel";
const FILA =
  "flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-ac-niebla focus-visible:outline-offset-[-2px]";
const TITULO_GRUPO =
  "mb-2 mt-6 px-1 text-[13px] font-semibold uppercase tracking-wide text-ac-neblina";

interface CentroAjustesProps {
  miembro: Pick<Miembro, "nombre" | "correo" | "rol" | "negocioNombre">;
  grupos: GrupoCentro[];
  verReservas: boolean;
  className?: string;
}

/**
 * Centro de Ajustes del celular (T-12.3): tarjeta del perfil y grupos con todo lo que no es pestaña.
 * Las opciones salen de `centroPara(rol)`, así cada rol ve lo que puede abrir.
 */
export function CentroAjustes({
  miembro,
  grupos,
  verReservas,
  className,
}: CentroAjustesProps) {
  return (
    <main className={cn("mx-auto w-full max-w-xl px-4 py-6", className)}>
      <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-2xl">
        Ajustes
      </h1>

      <section
        aria-label="Tu perfil"
        className={cn(TARJETA, "mt-4 flex items-center gap-3 p-4")}
      >
        <span
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ac-laguna text-[15px] font-bold text-ac-papel"
          aria-hidden="true"
        >
          {iniciales(miembro.nombre)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold">
            {miembro.nombre}
          </span>
          <span className="block truncate text-[13px] text-ac-pizarra">
            {miembro.correo}
          </span>
          <span className="mt-1 inline-block rounded-full bg-ac-laguna-claro px-2 py-0.5 text-xs font-semibold text-ac-laguna-hondo">
            {NOMBRE_ROL[miembro.rol]} · {miembro.negocioNombre}
          </span>
        </span>
      </section>

      {grupos.map((g) => (
        <section key={g.nombre} aria-labelledby={`centro-${g.nombre}`}>
          <h2 id={`centro-${g.nombre}`} className={TITULO_GRUPO}>
            {g.nombre}
          </h2>
          <ul className={cn(TARJETA, "divide-y divide-ac-borde")}>
            {g.opciones.map((o) => {
              const Icono = ICONOS[o.href] ?? Circle;
              return (
                <li key={o.href}>
                  <Link href={o.href} className={FILA}>
                    <span
                      className={cn(
                        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]",
                        COLOR_GRUPO[g.nombre],
                      )}
                      aria-hidden="true"
                    >
                      <Icono className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold">
                        {o.nombre}
                      </span>
                      <span className="block text-[13px] text-ac-pizarra">
                        {o.resumen}
                      </span>
                    </span>
                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-ac-neblina"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <CuentaCentro verReservas={verReservas} />
    </main>
  );
}
