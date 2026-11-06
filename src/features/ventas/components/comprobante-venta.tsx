"use client";

import { useRef } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  CheckCircle2,
  Eye,
  Loader2,
  Mail,
  MessageCircle,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { pesos } from "@/shared/lib/formato";
import { Button } from "@/shared/ui/button";
import { enviarComprobante } from "../actions";
import { enlaceWhatsapp, textoComprobante } from "../lib/comprobante";
import type { OrigenVenta } from "../store/panel-venta";
import type { CobroHecho } from "../types";

export interface DatosComprobante {
  cobro: CobroHecho;
  cliente: string | null;
  /** Primer nombre, para el saludo del WhatsApp. */
  saludo: string | null;
  lugar: string | null;
  telefono: string | null;
  correo: string | null;
  medios: string;
  items: { descripcion: string; cantidad: number; total: number }[];
  subtotal: number;
  descuento: number;
  propina: number;
}

const VUELTA: Record<OrigenVenta["tipo"], string> = {
  agenda: "Volver a la agenda",
  cita: "Volver a la cita",
  ventas: "Volver a Ventas",
};

function Linea({
  titulo,
  valor,
  fuerte,
}: {
  titulo: string;
  valor: string;
  fuerte?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <dt className="text-ac-pizarra">{titulo}</dt>
      <dd
        className={
          fuerte
            ? "cifras text-base font-bold"
            : "cifras text-right font-medium"
        }
      >
        {valor}
      </dd>
    </div>
  );
}

/** Comprobante: check verde, número, cliente, medio, subtotal, descuento, vuelto y total (US-039). */
export function ComprobanteVenta({
  datos,
  origen,
  onVer,
  onCerrar,
  onVolver,
}: {
  datos: DatosComprobante;
  origen: OrigenVenta | null;
  onVer: () => void;
  onCerrar: () => void;
  onVolver: () => void;
}) {
  const { cobro } = datos;
  const [enviando, iniciar] = useTransicionRed();
  const anotadoWhatsapp = useRef(false);
  const parcial = cobro.estado === "parcial";

  function enviar() {
    iniciar(async () => {
      const r = await enviarComprobante(cobro.ventaId);
      if (!r.ok) toast.error(r.error);
      else if (r.datos.sinContacto)
        toast.info(
          "El cliente no tiene correo ni teléfono: el comprobante no se envió",
        );
      else toast.success("Comprobante enviado: míralo en el buzón de la demo");
    });
  }

  function porCorreo() {
    iniciar(async () => {
      const r = await enviarComprobante(cobro.ventaId, "correo");
      if (!r.ok) toast.error(r.error);
      else
        toast.success(
          "Comprobante enviado por correo: míralo en el buzón de la demo",
        );
    });
  }

  /**
   * El enlace abre WhatsApp; si el cliente tiene teléfono, la copia queda una sola vez en el buzón de la demo
   * (sin teléfono, WhatsApp pide elegir el contacto y no se anota nada).
   */
  function porWhatsapp() {
    if (!datos.cliente || !datos.telefono || anotadoWhatsapp.current) return;
    anotadoWhatsapp.current = true;
    void enviarComprobante(cobro.ventaId, "whatsapp").then((r) => {
      if (r.ok && !r.datos.sinContacto) toast.success("Enviado por WhatsApp");
      else anotadoWhatsapp.current = false;
    });
  }

  const mensaje = textoComprobante({
    nombre: datos.saludo,
    lugar: datos.lugar,
    numero: cobro.numero,
    items: datos.items,
    total: cobro.total,
    pagado: cobro.pagado,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto py-2 text-center">
      <CheckCircle2 className="h-14 w-14 text-ac-exito" aria-hidden="true" />
      <div>
        <p className="text-lg font-bold">
          {parcial ? "Abono registrado" : "El pago se realizó con éxito"}
        </p>
        <p className="cifras text-ac-pizarra">Venta {cobro.numero}</p>
      </div>
      <ul
        aria-label="Detalle de la venta"
        className="w-full max-w-sm divide-y divide-ac-borde rounded-lg border border-ac-borde bg-ac-papel px-4 text-left text-sm md:hidden"
      >
        {datos.items.map((i, n) => (
          <li key={n} className="flex justify-between gap-4 py-1.5">
            <span className="min-w-0">
              {i.descripcion}
              {i.cantidad > 1 ? (
                <span className="cifras text-ac-pizarra"> × {i.cantidad}</span>
              ) : null}
            </span>
            <span className="cifras font-medium">{pesos(i.total)}</span>
          </li>
        ))}
      </ul>
      <dl className="w-full max-w-sm divide-y divide-ac-borde rounded-lg border border-ac-borde bg-ac-papel px-4 text-left text-sm">
        <Linea titulo="Cliente" valor={datos.cliente ?? "Sin cliente"} />
        <Linea titulo="Medio de pago" valor={datos.medios} />
        <Linea titulo="Subtotal" valor={pesos(datos.subtotal)} />
        {datos.descuento ? (
          <Linea titulo="Descuento" valor={`−${pesos(datos.descuento)}`} />
        ) : null}
        {cobro.vuelto ? (
          <Linea titulo="Vuelto" valor={pesos(cobro.vuelto)} />
        ) : null}
        {datos.propina ? (
          <Linea titulo="Propina" valor={pesos(datos.propina)} />
        ) : null}
        <Linea titulo="Total" valor={pesos(cobro.total)} fuerte />
        {parcial ? (
          <>
            <Linea titulo="Pagado" valor={pesos(cobro.pagado)} />
            <Linea
              titulo="Saldo pendiente"
              valor={pesos(cobro.total - cobro.pagado)}
              fuerte
            />
          </>
        ) : null}
      </dl>
      {parcial ? (
        <p className="max-w-sm text-sm text-ac-pizarra">
          El saldo queda en Ventas → Mis cobros para pagarlo después.
        </p>
      ) : null}
      {cobro.giftCards.length ? (
        <section
          aria-label="Gift cards vendidas"
          className="w-full max-w-sm space-y-2 text-left"
        >
          {cobro.giftCards.map((g) => (
            <div
              key={g.codigo}
              className="rounded-lg border border-ac-laguna/40 bg-ac-laguna-claro p-3"
            >
              <p className="text-xs text-ac-laguna-hondo">{g.nombre}</p>
              <p className="cifras text-xl font-bold tracking-wider">
                {g.codigo}
              </p>
              <p className="cifras text-xs text-ac-pizarra">
                Saldo {pesos(g.saldo)} · vence el{" "}
                {format(parseISO(g.vence), "d MMM yyyy", { locale: es })}
              </p>
            </div>
          ))}
          <p className="text-xs text-ac-pizarra">
            Entrega el código: con él se paga en la caja (método «Gift card»).
          </p>
        </section>
      ) : null}
      <section
        aria-label="Enviar comprobante"
        className="w-full max-w-sm space-y-2 text-left md:hidden"
      >
        <p className="text-sm font-semibold">
          Enviar comprobante{datos.saludo ? ` a ${datos.saludo}` : ""}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" asChild>
            <a
              href={enlaceWhatsapp(datos.telefono, mensaje)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={porWhatsapp}
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> Enviar
              por WhatsApp
            </a>
          </Button>
          <Button
            variant="outline"
            onClick={porCorreo}
            disabled={enviando || !datos.correo}
          >
            {enviando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Mail className="h-4 w-4" aria-hidden="true" />
            )}
            Enviar por correo
          </Button>
        </div>
        {datos.cliente && !datos.correo ? (
          <p className="text-xs text-ac-pizarra">
            {datos.cliente} no tiene correo: agrégalo en su ficha.
          </p>
        ) : null}
      </section>
      <div className="mt-auto flex w-full max-w-sm flex-col gap-2 md:hidden">
        <Button variant="outline" onClick={onVer}>
          <Eye className="h-4 w-4" aria-hidden="true" /> Ver detalle
        </Button>
        <Button
          className="rounded-full md:rounded-md"
          size="lg"
          onClick={onVolver}
        >
          {origen ? VUELTA[origen.tipo] : "Cerrar"}
        </Button>
      </div>
      <div className="mt-auto hidden w-full max-w-sm flex-row gap-2 md:flex">
        <Button
          variant="outline"
          className="flex-1"
          onClick={enviar}
          disabled={enviando}
        >
          {enviando ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
          Enviar
        </Button>
        <Button variant="outline" className="flex-1" onClick={onVer}>
          <Eye className="h-4 w-4" aria-hidden="true" /> Ver
        </Button>
        <Button className="flex-1" onClick={onCerrar}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}
