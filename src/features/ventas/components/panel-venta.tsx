"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, BadgePercent, Loader2 } from "lucide-react";
import { useConfirmar } from "@/shared/components/confirmar";
import { useEsCelular } from "@/shared/hooks/use-es-celular";
import { pesos } from "@/shared/lib/formato";
import { Button } from "@/shared/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/shared/ui/sheet";
import { prepararVenta } from "../actions";
import { useFlujoVenta, type FlujoVenta } from "../hooks/use-flujo-venta";
import { usePanelVenta, type PedidoVenta } from "../store/panel-venta";
import type { DatosPanel } from "../types";
import { CarritoCelular } from "./carrito-celular";
import { CatalogoVenta } from "./catalogo-venta";
import { ComprobanteVenta } from "./comprobante-venta";
import { DialogoVenta } from "./dialogo-venta";
import { HojaDescuento } from "./hoja-descuento";
import { PagoVenta } from "./pago-venta";
import { ResumenVenta } from "./resumen-venta";

function Encabezado({
  titulo,
  detalle,
  onAtras,
}: {
  titulo: string;
  detalle?: string;
  /** Flecha atrás del celular (en la tableta se cierra con la X). */
  onAtras?: () => void;
}) {
  return (
    <div
      data-con-atras={onAtras ? "" : undefined}
      className="flex items-center gap-1 border-b border-ac-borde px-4 py-3.5 pr-12 sm:px-6"
    >
      {onAtras ? (
        <button
          type="button"
          onClick={onAtras}
          aria-label="Atrás"
          className="-ml-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-ac-niebla md:hidden"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
      ) : null}
      <div className="min-w-0">
        <SheetTitle className="text-lg">{titulo}</SheetTitle>
        <SheetDescription
          className={detalle ? "text-sm text-ac-pizarra" : "sr-only"}
        >
          {detalle ?? "Panel de venta"}
        </SheetDescription>
      </div>
    </div>
  );
}

/** En el cobro del celular, el descuento se pone o se cambia sin volver al carrito. */
function FilaDescuento({ f }: { f: FlujoVenta }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        disabled={f.pagando}
        aria-label={
          f.desc ? `Descuento: −${pesos(f.desc)}` : "Agregar descuento"
        }
        className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-ac-borde px-4 text-sm md:hidden"
      >
        <span className="inline-flex items-center gap-2 font-medium text-ac-laguna-hondo">
          <BadgePercent className="h-4 w-4" aria-hidden="true" />
          {f.desc ? "Descuento" : "Agregar descuento"}
        </span>
        {f.desc ? (
          <span className="cifras font-semibold">−{pesos(f.desc)}</span>
        ) : null}
      </button>
      <HojaDescuento
        abierta={abierta}
        onCambiar={setAbierta}
        descuento={f.descuento}
        subtotal={f.sub}
        onAplicar={f.setDescuento}
      />
    </>
  );
}

/** En el cobro del celular, qué se está cobrando (al cobrar una cita se llega aquí sin pasar por el carrito). */
function LoQueSeCobra({ f }: { f: FlujoVenta }) {
  return (
    <ul
      aria-label="Lo que se cobra"
      className="divide-y divide-ac-borde rounded-xl border border-ac-borde bg-ac-papel px-4 md:hidden"
    >
      {f.items.map((i) => (
        <li
          key={i.clave}
          className="flex items-start justify-between gap-3 py-2.5"
        >
          <span className="min-w-0 text-sm">
            <span className="block font-medium">
              {i.descripcion}
              {i.cantidad > 1 ? ` × ${i.cantidad}` : ""}
            </span>
            {i.fecha ? (
              <span className="block text-xs text-ac-pizarra">
                {`Cita del ${format(parseISO(i.fecha), "EEEE d MMM", { locale: es })}${i.hora ? ` · ${i.hora}` : ""}`}
              </span>
            ) : null}
          </span>
          <span className="cifras shrink-0 text-sm font-semibold">
            {pesos(i.cantidad * i.precioUnitario)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Armar en la tableta: catálogo a la izquierda y la venta a la derecha. */
function ArmarTableta({ f, datos }: { f: FlujoVenta; datos: DatosPanel }) {
  return (
    <div className="grid min-h-0 flex-1 gap-6 p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
      <div className="flex min-h-0 flex-col">
        <CatalogoVenta
          datos={datos}
          pestana={f.pestana}
          onPestana={f.setPestana}
          onAgregar={f.agregar}
          onAgregarProducto={f.agregarProducto}
          onAgregarExtra={f.agregarExtra}
          onItemLibre={f.agregarLibre}
          cliente={f.cliente}
          onCliente={f.elegirCliente}
          descuento={f.descuento}
          onDescuento={f.setDescuento}
        />
      </div>
      <div className="flex min-h-0 flex-col md:border-l md:border-ac-borde md:pl-6">
        <ResumenVenta
          datos={datos}
          items={f.items}
          cliente={f.cliente}
          subtotal={f.sub}
          descuento={f.desc}
          error={f.error}
          onCambiarCliente={() => f.verCatalogo("clientes")}
          onItem={f.cambiarItem}
          onQuitar={f.quitarItem}
          onAgregarMovil={() => f.verCatalogo("items")}
          onContinuar={f.continuar}
        />
      </div>
    </div>
  );
}

/** Los pasos de la venta: armar (en el celular, el carrito), pagar y comprobante. */
function FlujoVenta({
  datos,
  onVer,
  onCerrar,
}: {
  datos: DatosPanel;
  onVer: (id: string) => void;
  onCerrar: () => void;
}) {
  // El panel solo se abre tras un toque: el `true` del servidor no cambia la hidratación.
  const celular = useEsCelular();
  const f = useFlujoVenta(datos, celular);
  const origen = usePanelVenta((s) => s.origen);
  const volver = usePanelVenta((s) => s.volver);
  const setSalida = usePanelVenta((s) => s.setSalida);
  const router = useRouter();
  const [dialogo, confirmar] = useConfirmar();
  const local = datos.locales.find((l) => l.id === datos.localId)?.nombre;

  /** Con ítems en el carrito del celular, pregunta antes de salir sin cobrar. */
  async function salirSinCobrar() {
    if (f.pagando) return;
    if (
      f.items.length &&
      !(await confirmar({
        titulo: "¿Salir sin cobrar?",
        texto: "Se pierde lo que agregaste al carrito.",
        aceptar: "Salir",
        peligro: true,
      }))
    )
      return;
    onCerrar();
  }

  /** Flecha atrás del carrito: del catálogo vuelve al carrito; si no, sale (preguntando si hay ítems). */
  function atrasCarrito() {
    if (f.movil === "catalogo") return f.setMovil("venta");
    void salirSinCobrar();
  }

  // La X y Escape del panel usan la misma salida que la flecha (solo en el celular, con algo en el carrito).
  const cuidarSalida =
    celular && f.paso !== "listo" && !datos.saldo && f.items.length > 0;
  useEffect(() => {
    if (!cuidarSalida) return;
    setSalida(() => void salirSinCobrar());
    return () => setSalida(null);
  });

  if (f.paso === "listo" && f.comprobante) {
    const { comprobante } = f;
    return (
      <>
        <Encabezado titulo="Venta cerrada" detalle={local} />
        <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6">
          <ComprobanteVenta
            datos={comprobante}
            origen={origen}
            onVer={() => onVer(comprobante.cobro.ventaId)}
            onCerrar={onCerrar}
            onVolver={() => {
              volver();
              router.refresh();
            }}
          />
        </div>
      </>
    );
  }

  if (f.paso === "pagar")
    return (
      <>
        <Encabezado
          titulo={
            datos.saldo
              ? `Pagar saldo · Venta ${datos.saldo.numero}`
              : "Método de pago"
          }
          detalle={datos.saldo ? datos.saldo.detalle : local}
          onAtras={
            f.pagando
              ? undefined
              : datos.saldo
                ? onCerrar
                : () => f.setPaso("armar")
          }
        />
        <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
          {datos.saldo ? null : (
            <Button
              variant="ghost"
              size="sm"
              className="hidden self-start md:inline-flex"
              onClick={() => f.setPaso("armar")}
              disabled={f.pagando}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver a la
              venta
            </Button>
          )}
          <div className="flex items-baseline justify-between rounded-lg bg-ac-niebla px-4 py-3">
            <span className="text-sm text-ac-pizarra">
              {datos.saldo ? "Saldo por pagar" : "Total a pagar"}
              {f.cliente ? ` · ${f.cliente.nombre} ${f.cliente.apellido}` : ""}
            </span>
            <span className="cifras text-2xl font-bold">{pesos(f.saldo)}</span>
          </div>
          {datos.saldo ? null : <LoQueSeCobra f={f} />}
          {datos.saldo ? null : <FilaDescuento f={f} />}
          <PagoVenta
            propina={celular}
            metodos={datos.metodos}
            saldo={f.saldo}
            pagando={f.pagando}
            errorServidor={f.errorPago}
            onPagar={f.pagar}
          />
        </div>
        {dialogo}
      </>
    );

  if (celular)
    return (
      <>
        <Encabezado
          titulo={f.movil === "catalogo" ? "Agregar al carrito" : "Nueva venta"}
          detalle={local}
          onAtras={atrasCarrito}
        />
        <CarritoCelular f={f} datos={datos} />
        {dialogo}
      </>
    );

  return (
    <>
      <Encabezado titulo="Nueva venta" detalle={local} />
      <ArmarTableta f={f} datos={datos} />
    </>
  );
}

function CargaPanel({
  pedido,
  onVer,
  onCerrar,
}: {
  pedido: PedidoVenta;
  onVer: (id: string) => void;
  onCerrar: () => void;
}) {
  const consulta = useQuery({
    queryKey: ["panel-venta", pedido],
    queryFn: () => prepararVenta(pedido),
    staleTime: 0,
    gcTime: 0,
  });
  if (consulta.isPending)
    return (
      <>
        <Encabezado titulo="Nueva venta" />
        <div className="flex flex-1 items-center justify-center">
          <Loader2
            className="h-6 w-6 animate-spin text-ac-pizarra"
            aria-label="Cargando"
          />
        </div>
      </>
    );
  if (!consulta.data?.ok)
    return (
      <>
        <Encabezado titulo="No se puede cobrar" />
        <div className="space-y-4 p-6">
          <p role="alert" className="text-ac-error">
            {consulta.data && !consulta.data.ok
              ? consulta.data.error
              : "No se pudo abrir la venta. Intenta de nuevo."}
          </p>
          <Button variant="outline" onClick={onCerrar}>
            Cerrar
          </Button>
        </div>
      </>
    );
  return (
    <FlujoVenta datos={consulta.data.datos} onVer={onVer} onCerrar={onCerrar} />
  );
}

/** Panel de venta único de la app: entra por la derecha; en celular ocupa la pantalla (US-038). */
export function PanelVenta() {
  const pedido = usePanelVenta((s) => s.pedido);
  const cerrar = usePanelVenta((s) => s.cerrar);
  const verId = usePanelVenta((s) => s.viendo);
  const setVerId = usePanelVenta((s) => s.ver);
  // El panel se abre desde el store, sin disparador: al cerrarlo, el foco vuelve a lo que lo abrió.
  const origenFoco = useRef<HTMLElement | null>(null);
  return (
    <>
      <Sheet
        open={pedido !== null}
        onOpenChange={(abierto) => {
          if (abierto) return;
          const salida = usePanelVenta.getState().salida;
          if (salida) salida();
          else cerrar();
        }}
      >
        <SheetContent
          side="right"
          // Con la flecha atrás (carrito del celular) la X sobra; desde la tableta vuelve.
          className="flex w-full flex-col gap-0 p-0 sm:max-w-none md:w-[min(980px,94vw)] [&:has([data-con-atras])>[data-cerrar]]:hidden md:[&:has([data-con-atras])>[data-cerrar]]:block"
          onOpenAutoFocus={() => {
            const a = document.activeElement;
            origenFoco.current =
              a instanceof HTMLElement && a !== document.body ? a : null;
          }}
          onCloseAutoFocus={(e) => {
            const o = origenFoco.current;
            origenFoco.current = null;
            if (o?.isConnected) {
              e.preventDefault();
              o.focus();
            }
          }}
        >
          {pedido ? (
            <CargaPanel
              key={JSON.stringify(pedido)}
              pedido={pedido}
              onCerrar={cerrar}
              onVer={(id) => {
                cerrar();
                setVerId(id);
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
      {verId ? (
        <DialogoVenta ventaId={verId} onCerrar={() => setVerId(null)} />
      ) : null}
    </>
  );
}
