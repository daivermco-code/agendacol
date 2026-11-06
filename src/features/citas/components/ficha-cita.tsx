"use client";

import type { ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  Armchair,
  CircleDollarSign,
  Globe,
  Lock,
  Mail,
  Pencil,
  Phone,
  Repeat,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { pesos, telefono } from "@/shared/lib/formato";
import { cn } from "@/shared/lib/utils";
import { Hoja } from "@/shared/components/hoja";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/shared/ui/popover";
import type { EstadoCita } from "@/features/agenda/lib/estados";
import type { CitaAgenda, ProfesionalAgenda } from "@/features/agenda/types";
import { AvatarProfesional } from "@/features/agenda/components/piezas";
import { PlanCita } from "@/features/planes/components/plan-cita";
import { EnviarWhatsapp } from "@/features/whatsapp/components/enviar-whatsapp";
import { CalificacionCita } from "./calificacion-cita";
import { PuntosEstado } from "./estado-cita";
import { esClienteNuevo } from "./tarjeta-cliente";

const ICONO_BOTON =
  "inline-flex h-11 w-11 md:h-8 md:w-8 items-center justify-center rounded-full text-ac-pizarra hover:bg-ac-niebla hover:text-ac-tinta";

function Dato({
  icono,
  vacio,
  children,
}: {
  icono: ReactNode;
  vacio?: boolean;
  children: ReactNode;
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 text-sm",
        vacio && "text-ac-neblina",
      )}
    >
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        {icono}
      </span>
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}

export interface PropsFicha {
  cita: CitaAgenda;
  profesional?: ProfesionalAgenda;
  /** Nombre del recurso (sala, silla…) que ocupa la cita. */
  recurso?: string;
  puedeEditar: boolean;
  verContacto: boolean;
  onEstado: (e: EstadoCita) => void;
  onEditar: () => void;
  onEliminar: () => void;
  onCerrar: () => void;
  /** Cobrar la cita (o pagar su saldo) y ver su venta; solo para quien puede cobrar. */
  onPagar?: () => void;
  onVerVenta?: () => void;
}

function FilaPago({
  cita,
  onPagar,
  onVerVenta,
}: Pick<PropsFicha, "cita" | "onPagar" | "onVerVenta">) {
  if (!onPagar) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-ac-borde pt-3">
      {cita.pagada ? (
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-ac-exito">
          <CircleDollarSign className="h-4 w-4" aria-hidden="true" /> Pagada
        </span>
      ) : (
        <Button size="sm" onClick={onPagar}>
          <CircleDollarSign className="h-4 w-4" aria-hidden="true" />
          {cita.pagoParcial
            ? "Pagar saldo"
            : cita.bonoId
              ? "Registrar con plan"
              : `Pagar ${pesos(cita.precio)}`}
        </Button>
      )}
      {cita.ventaId && onVerVenta ? (
        <Button size="sm" variant="ghost" onClick={onVerVenta}>
          Ver venta
        </Button>
      ) : null}
    </div>
  );
}

/** Contenido de la ficha: cliente, servicio, cuándo, con quién, contacto y los 6 puntos de estado. */
export function FichaCita(p: PropsFicha) {
  const { cita } = p;
  const cancelada = cita.estado === "cancelado";
  const cuando = format(parseISO(cita.fecha), "EEEE d 'de' MMMM", {
    locale: es,
  });
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {esClienteNuevo(cita.clienteDesde) ? (
          <span className="rounded-full bg-ac-laguna-claro px-2 py-0.5 text-[11px] font-semibold text-ac-laguna-hondo">
            Nuevo cliente
          </span>
        ) : null}
        <span className="flex-1" />
        {p.puedeEditar ? (
          <>
            <button
              type="button"
              aria-label="Cancelar o eliminar cita"
              className={ICONO_BOTON}
              onClick={p.onEliminar}
            >
              <Trash2 className="h-4 w-4" />
            </button>
            {cancelada ? null : (
              <button
                type="button"
                aria-label="Editar cita"
                className={ICONO_BOTON}
                onClick={p.onEditar}
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </>
        ) : null}
        <button
          type="button"
          aria-label="Cerrar ficha"
          className={ICONO_BOTON}
          onClick={p.onCerrar}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div>
        <p
          className={cn(
            "text-[17px] font-semibold leading-tight",
            cancelada && "line-through",
          )}
        >
          {cita.clienteNombre}
        </p>
        <p className="text-sm">
          {cita.servicioNombre} ·{" "}
          <span className="cifras">{pesos(cita.precio)}</span>
        </p>
        <p className="cifras text-sm text-ac-pizarra">
          {cuando.charAt(0).toUpperCase() + cuando.slice(1)} · {cita.horaInicio}{" "}
          – {cita.horaFin}
        </p>
      </div>
      {p.profesional ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-ac-pizarra">Se atenderá con</span>
          <AvatarProfesional profesional={p.profesional} tamano={22} />
          <span className="font-medium">{p.profesional.nombre}</span>
          {cita.profesionalFijo ? (
            <Lock className="h-3.5 w-3.5" aria-label="Profesional fijo" />
          ) : null}
        </div>
      ) : null}
      {p.recurso ? (
        <div className="flex items-center gap-2 text-sm">
          <Armchair className="h-4 w-4 text-ac-pizarra" aria-hidden="true" />
          <span className="text-ac-pizarra">En</span>
          <span className="font-medium">{p.recurso}</span>
        </div>
      ) : null}
      <div className="space-y-1.5 border-t border-ac-borde pt-3">
        {p.verContacto ? (
          <>
            <Dato
              icono={<Phone className="h-4 w-4" />}
              vacio={!cita.clienteTelefono}
            >
              {telefono(cita.clienteTelefono) || "Sin teléfono"}
            </Dato>
            <Dato
              icono={<Mail className="h-4 w-4" />}
              vacio={!cita.clienteCorreo}
            >
              {cita.clienteCorreo ?? "Sin correo"}
            </Dato>
          </>
        ) : (
          <p className="text-[13px] text-ac-neblina">
            El contacto del cliente lo ve recepción.
          </p>
        )}
        {cita.notaCliente ? (
          <Dato icono={<StickyNote className="h-4 w-4" />}>
            {cita.notaCliente}
          </Dato>
        ) : null}
        {cita.notaInterna ? (
          <Dato icono={<StickyNote className="h-4 w-4 text-ac-aviso" />}>
            Interna: {cita.notaInterna}
          </Dato>
        ) : null}
        {cita.serieId ? (
          <Dato icono={<Repeat className="h-4 w-4" />}>Parte de una serie</Dato>
        ) : null}
        {cita.origen === "en_linea" ? (
          <Dato icono={<Globe className="h-4 w-4" />}>Reservó en línea</Dato>
        ) : null}
      </div>
      <div className="border-t border-ac-borde pt-3">
        {cancelada ? (
          <p className="text-sm text-ac-pizarra">
            Cancelada
            {cita.motivoCancelacion ? `: ${cita.motivoCancelacion}` : ""}
          </p>
        ) : (
          <PuntosEstado actual={cita.estado} onCambio={p.onEstado} />
        )}
      </div>
      {cancelada || !p.puedeEditar ? null : <PlanCita cita={cita} />}
      {cancelada ? null : (
        <FilaPago cita={cita} onPagar={p.onPagar} onVerVenta={p.onVerVenta} />
      )}
      {cita.estado === "asiste" ? <CalificacionCita citaId={cita.id} /> : null}
      {p.puedeEditar && p.verContacto && cita.clienteTelefono && !cancelada ? (
        <EnviarWhatsapp key={cita.id} citaId={cita.id} />
      ) : null}
    </div>
  );
}

const ANCHO_FICHA = 340;

/** Al lado del bloque si cabe; si la columna ocupa casi todo el ancho (una sola columna), debajo. */
function ladoFicha(rect: DOMRect): "right" | "left" | "bottom" {
  if (window.innerWidth - rect.right >= ANCHO_FICHA + 16) return "right";
  if (rect.left >= ANCHO_FICHA + 16) return "left";
  return "bottom";
}

/** Ficha flotante junto al bloque en computador y tableta; hoja desde abajo en el celular. */
export function FichaFlotante({
  rect,
  esCelular,
  onCerrar,
  ...ficha
}: PropsFicha & { rect: DOMRect; esCelular: boolean }) {
  return (
    <Flotante
      rect={rect}
      esCelular={esCelular}
      titulo={`Cita de ${ficha.cita.clienteNombre}`}
      descripcion="Detalle y estado de la cita"
      onCerrar={onCerrar}
    >
      <FichaCita {...ficha} onCerrar={onCerrar} />
    </Flotante>
  );
}

/** Popover junto al bloque (o hoja desde abajo en el celular) para las fichas de la agenda. */
export function Flotante({
  rect,
  esCelular,
  titulo,
  descripcion,
  onCerrar,
  children,
}: {
  rect: DOMRect;
  esCelular: boolean;
  titulo: string;
  descripcion: string;
  onCerrar: () => void;
  children: ReactNode;
}) {
  if (esCelular) {
    // La ficha trae su propio "Cerrar ficha" y su cabecera: la hoja solo pone el asa y el arrastre.
    return (
      <Hoja
        abierta
        onCambiar={(v) => !v && onCerrar()}
        titulo={titulo}
        descripcion={descripcion}
        tituloOculto
        sinCerrar
      >
        {children}
      </Hoja>
    );
  }
  return (
    <Popover open onOpenChange={(v) => !v && onCerrar()}>
      <PopoverAnchor asChild>
        <div
          aria-hidden="true"
          className="pointer-events-none fixed"
          style={{
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          }}
        />
      </PopoverAnchor>
      <PopoverContent
        side={ladoFicha(rect)}
        align="start"
        collisionPadding={12}
        className="max-h-[var(--radix-popover-content-available-height)] w-[340px] overflow-y-auto border-ac-borde p-4 shadow-flota"
        aria-label={titulo}
        role="dialog"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
