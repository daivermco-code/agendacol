"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Loader2, Send, Wallet } from "lucide-react";
import { toast } from "sonner";
import { usePuede } from "@/features/auth/components/proveedor-miembro";
import { CLAVE_AGENDA } from "@/features/agenda/hooks/use-agenda";
import { Campo } from "@/shared/components/campo";
import { pesos } from "@/shared/lib/formato";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Textarea } from "@/shared/ui/textarea";
import { anularVenta, enviarComprobante, verVenta } from "../actions";
import { usePanelVenta } from "../store/panel-venta";
import type { DetalleVenta } from "../types";
import { PildoraVenta } from "./pildora-venta";

const fechaHora = (f: string) =>
  format(parseISO(f), "d MMM yyyy · HH:mm", { locale: es });

function Anular({
  venta,
  onListo,
  onCancelar,
}: {
  venta: DetalleVenta;
  onListo: () => void;
  onCancelar: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [anulando, iniciar] = useTransicionRed();
  const qc = useQueryClient();
  function anular() {
    iniciar(async () => {
      const r = await anularVenta({ ventaId: venta.id, motivo });
      if (!r.ok) return setError(r.error);
      toast.success(`Venta ${venta.numero} anulada`);
      void qc.invalidateQueries({ queryKey: [CLAVE_AGENDA] });
      void qc.invalidateQueries({ queryKey: ["venta", venta.id] });
      onListo();
    });
  }
  return (
    <div className="space-y-3 rounded-lg border border-ac-error/30 bg-ac-error/5 p-3">
      <p className="text-sm">
        La venta queda guardada como anulada, la caja registra la devolución y
        sus citas vuelven a Mis cobros.
      </p>
      <Campo
        id="motivo-anulacion"
        etiqueta="Motivo de la anulación"
        obligatorio
        error={error ?? undefined}
      >
        <Textarea
          id="motivo-anulacion"
          value={motivo}
          maxLength={200}
          rows={2}
          onChange={(e) => {
            setMotivo(e.target.value);
            setError(null);
          }}
        />
      </Campo>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancelar} disabled={anulando}>
          No anular
        </Button>
        <Button variant="destructive" onClick={anular} disabled={anulando}>
          {anulando ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : null}
          Anular venta
        </Button>
      </div>
    </div>
  );
}

function Cuerpo({ v }: { v: DetalleVenta }) {
  return (
    <div className="space-y-4 text-sm">
      {v.estado === "anulada" ? (
        <p className="rounded-md bg-ac-niebla px-3 py-2">
          Anulada{v.anuladaAt ? ` el ${fechaHora(v.anuladaAt)}` : ""}
          {v.anuladaPor ? ` por ${v.anuladaPor}` : ""}: {v.motivoAnulacion}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-between gap-2">
        <p>
          <span className="text-ac-pizarra">Cliente: </span>
          {v.cliente ? (
            <Link
              href={`/clientes/${v.cliente.id}`}
              className="font-medium text-ac-laguna-hondo hover:underline"
            >
              {v.cliente.nombre}
            </Link>
          ) : (
            "Sin cliente"
          )}
        </p>
        {v.creadaPor ? (
          <p className="text-ac-pizarra">Cobró {v.creadaPor}</p>
        ) : null}
      </div>
      <table className="w-full">
        <caption className="sr-only">Ítems</caption>
        <thead className="text-left text-xs text-ac-pizarra">
          <tr>
            <th scope="col" className="py-1 font-medium">
              Ítem
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              Cant.
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {v.items.map((i, n) => (
            <tr key={n} className="border-t border-ac-borde">
              <td className="py-2">
                {i.descripcion}
                <span className="block text-xs text-ac-pizarra">
                  {[i.profesional, i.cita ? `cita ${i.cita}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </td>
              <td className="cifras py-2 text-right">{i.cantidad}</td>
              <td className="cifras py-2 text-right">{pesos(i.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="space-y-1 border-t border-ac-borde pt-2">
        <div className="flex justify-between">
          <dt className="text-ac-pizarra">Subtotal</dt>
          <dd className="cifras">{pesos(v.subtotal)}</dd>
        </div>
        {v.descuento ? (
          <div className="flex justify-between">
            <dt className="text-ac-pizarra">Descuento</dt>
            <dd className="cifras">−{pesos(v.descuento)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between text-base font-bold">
          <dt>Total</dt>
          <dd className="cifras">{pesos(v.total)}</dd>
        </div>
        {v.estado === "parcial" ? (
          <div className="flex justify-between font-semibold text-ac-aviso">
            <dt>Saldo pendiente</dt>
            <dd className="cifras">{pesos(v.total - v.pagado)}</dd>
          </div>
        ) : null}
      </dl>
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ac-pizarra">
          Pagos
        </p>
        <ul className="divide-y divide-ac-borde rounded-md border border-ac-borde">
          {v.pagos.map((x, n) => (
            <li
              key={n}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <span className="min-w-0">
                <span className="font-medium">{x.metodo}</span>
                {x.abono ? (
                  <span className="ml-1 text-xs text-ac-aviso">abono</span>
                ) : null}
                <span className="block text-xs text-ac-pizarra">
                  {fechaHora(x.fecha)}
                  {x.comprobante ? ` · comprobante ${x.comprobante}` : ""}
                  {x.recibido && x.recibido > x.monto
                    ? ` · recibió ${pesos(x.recibido)}`
                    : ""}
                </span>
              </span>
              <span className="cifras">{pesos(x.monto)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Ventana "ver venta": ítems, pagos, totales; enviar comprobante, pagar saldo y anular (dueño). */
export function DialogoVenta({
  ventaId,
  onCerrar,
}: {
  ventaId: string;
  onCerrar: () => void;
}) {
  const puedo = usePuede();
  const abrirPanel = usePanelVenta((s) => s.abrir);
  const [anulando, setAnulando] = useState(false);
  const [enviando, iniciar] = useTransicionRed();
  const consulta = useQuery({
    queryKey: ["venta", ventaId],
    queryFn: () => verVenta(ventaId),
    staleTime: 0,
  });
  const v = consulta.data?.ok ? consulta.data.datos : null;

  function enviar() {
    iniciar(async () => {
      const r = await enviarComprobante(ventaId);
      if (!r.ok) toast.error(r.error);
      else if (r.datos.sinContacto)
        toast.info(
          "El cliente no tiene correo ni teléfono: el comprobante no se envió",
        );
      else toast.success("Comprobante enviado: míralo en el buzón de la demo");
    });
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="h-dvh max-h-dvh max-w-full rounded-none sm:rounded-none overflow-y-auto md:h-auto md:max-h-[92dvh] md:max-w-lg md:rounded-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Venta <span className="cifras">{v?.numero ?? ""}</span>
            {v ? <PildoraVenta estado={v.estado} /> : null}
          </DialogTitle>
          <DialogDescription>
            {v ? fechaHora(v.fecha) : "Cargando la venta…"}
          </DialogDescription>
        </DialogHeader>
        {consulta.isPending ? (
          <div className="flex justify-center py-10">
            <Loader2
              className="h-6 w-6 animate-spin text-ac-pizarra"
              aria-label="Cargando"
            />
          </div>
        ) : !v ? (
          <p role="alert" className="text-sm text-ac-error">
            {consulta.data && !consulta.data.ok
              ? consulta.data.error
              : "No se pudo cargar la venta."}
          </p>
        ) : (
          <>
            <Cuerpo v={v} />
            {anulando ? (
              <Anular
                venta={v}
                onListo={() => setAnulando(false)}
                onCancelar={() => setAnulando(false)}
              />
            ) : null}
          </>
        )}
        {v && !anulando ? (
          <DialogFooter className="gap-2 sm:justify-between">
            {v.estado !== "anulada" && puedo("anular_venta") ? (
              <Button
                variant="ghost"
                className="text-ac-error"
                onClick={() => setAnulando(true)}
              >
                <Ban className="h-4 w-4" aria-hidden="true" /> Anular
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              {v.estado !== "anulada" && v.cliente && puedo("cobrar") ? (
                <Button variant="outline" onClick={enviar} disabled={enviando}>
                  <Send className="h-4 w-4" aria-hidden="true" /> Enviar
                  comprobante
                </Button>
              ) : null}
              {v.estado === "parcial" && puedo("cobrar") ? (
                <Button
                  onClick={() => {
                    onCerrar();
                    abrirPanel({ ventaId: v.id });
                  }}
                >
                  <Wallet className="h-4 w-4" aria-hidden="true" /> Pagar saldo
                </Button>
              ) : null}
            </div>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
