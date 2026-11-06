"use client";

import { useState } from "react";
import { useTransicionRed } from "@/shared/hooks/use-transicion-red";
import { useQueryClient } from "@tanstack/react-query";
import { CLAVE_AGENDA } from "@/features/agenda/hooks/use-agenda";
import type { ClienteResumen } from "@/features/clientes/schemas";
import { nuevoId } from "@/shared/lib/id";
import { cerrarVenta, pagarSaldo } from "../actions";
import type { DatosComprobante } from "../components/comprobante-venta";
import type { Descuento, PestanaCatalogo } from "../components/catalogo-venta";
import type { ExtraVenta } from "../components/pestana-items";
import { descuentoEnPesos, subtotal } from "../lib/venta";
import type { PagoVenta as Pago } from "../schemas";
import type {
  DatosPanel,
  ItemPanel,
  ProductoVenta,
  ServicioVenta,
} from "../types";

export type Paso = "armar" | "pagar" | "listo";

/** Un ítem nuevo con lo que no viene se deja en null. */
function itemNuevo(
  descripcion: string,
  precio: number,
  ids: Partial<
    Pick<ItemPanel, "servicioId" | "productoId" | "planId" | "giftCardModeloId">
  > = {},
): ItemPanel {
  return {
    clave: nuevoId(),
    servicioId: ids.servicioId ?? null,
    productoId: ids.productoId ?? null,
    planId: ids.planId ?? null,
    giftCardModeloId: ids.giftCardModeloId ?? null,
    citaId: null,
    profesionalId: null,
    descripcion,
    cantidad: 1,
    precioUnitario: precio,
    fecha: null,
    hora: null,
  };
}

export function medios(pagos: Pago[], metodos: DatosPanel["metodos"]): string {
  return pagos
    .map((p) => {
      const nombre = metodos.find((m) => m.id === p.metodoId)?.nombre ?? "Pago";
      return p.comprobante ? `${nombre} (${p.comprobante})` : nombre;
    })
    .join(" + ");
}

/**
 * Estado de la venta en el panel: ítems, cliente, descuento, pasos y el cobro.
 * `movil` dice qué se ve en el celular: la venta (carrito) o el catálogo. `carritoPrimero` es el celular:
 * arranca en el carrito, o en el pago si ya trae citas.
 */
export function useFlujoVenta(datos: DatosPanel, carritoPrimero = false) {
  const qc = useQueryClient();
  // En el celular, cobrar citas va directo al pago; la flecha vuelve al carrito.
  const directo =
    carritoPrimero &&
    datos.items.length > 0 &&
    !datos.avisos.length &&
    (datos.cliente !== null || !datos.clienteObligatorio);
  const [paso, setPaso] = useState<Paso>(
    datos.saldo || directo ? "pagar" : "armar",
  );
  const [movil, setMovil] = useState<"venta" | "catalogo">(
    carritoPrimero || datos.items.length || datos.avisos.length
      ? "venta"
      : "catalogo",
  );
  const [pestana, setPestana] = useState<PestanaCatalogo>("items");
  const [items, setItems] = useState<ItemPanel[]>(datos.items);
  const [cliente, setCliente] = useState<ClienteResumen | null>(datos.cliente);
  const [descuento, setDescuento] = useState<Descuento>({
    modo: "pesos",
    valor: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [errorPago, setErrorPago] = useState<string | null>(null);
  const [comprobante, setComprobante] = useState<DatosComprobante | null>(null);
  const [pagando, iniciar] = useTransicionRed();
  const sub = subtotal(items);
  const desc = descuentoEnPesos(sub, descuento.modo, descuento.valor);
  const saldo = datos.saldo
    ? datos.saldo.total - datos.saldo.pagado
    : sub - desc;

  function agregar(s: ServicioVenta) {
    setError(null);
    setItems((lista) => {
      const igual = lista.find((i) => i.servicioId === s.id && !i.citaId);
      if (igual)
        return lista.map((i) =>
          i === igual ? { ...i, cantidad: Math.min(i.cantidad + 1, 99) } : i,
        );
      return [...lista, itemNuevo(s.nombre, s.precio, { servicioId: s.id })];
    });
  }

  /** Suma una unidad del producto sin pasar de sus existencias (la base lo vuelve a revisar al cobrar). */
  function agregarProducto(p: ProductoVenta) {
    const igual = items.find((i) => i.productoId === p.id);
    if ((igual?.cantidad ?? 0) >= p.existencias)
      return setError(`Solo quedan ${p.existencias} de ${p.nombre}`);
    setError(null);
    setItems((lista) =>
      igual
        ? lista.map((i) =>
            i.clave === igual.clave ? { ...i, cantidad: i.cantidad + 1 } : i,
          )
        : [...lista, itemNuevo(p.nombre, p.precio, { productoId: p.id })],
    );
  }

  function agregarLibre(descripcion: string, precio: number) {
    setItems((l) => [...l, itemNuevo(descripcion, precio)]);
  }

  /** Gift card o plan: va de a uno por ítem (cada uno deja su tarjeta o su plan). */
  function agregarExtra(extra: ExtraVenta) {
    setError(null);
    setItems((l) => [
      ...l,
      itemNuevo(extra.descripcion, extra.precio, {
        planId: extra.planId ?? null,
        giftCardModeloId: extra.giftCardModeloId ?? null,
      }),
    ]);
  }

  function cambiarItem(clave: string, cambio: Partial<ItemPanel>) {
    setItems((l) =>
      l.map((i) => (i.clave === clave ? { ...i, ...cambio } : i)),
    );
  }

  function quitarItem(clave: string) {
    setItems((l) => l.filter((i) => i.clave !== clave));
  }

  function elegirCliente(c: ClienteResumen | null) {
    setCliente(c);
    setError(null);
    setPestana("items");
    setMovil("venta");
  }

  function verCatalogo(p: PestanaCatalogo) {
    setPestana(p);
    setMovil("catalogo");
  }

  function continuar() {
    if (!items.length) return setError("Agrega al menos un ítem");
    if (datos.clienteObligatorio && !cliente) {
      verCatalogo("clientes");
      return setError("Elige el cliente de esta venta");
    }
    setErrorPago(null);
    setPaso("pagar");
  }

  function pagar(pagos: Pago[]) {
    setErrorPago(null);
    iniciar(async () => {
      const r = datos.saldo
        ? await pagarSaldo({ ventaId: datos.saldo.id, pagos })
        : await cerrarVenta({
            localId: datos.localId,
            clienteId: cliente?.id ?? null,
            descuento: desc,
            items: items.map(
              ({ clave: _c, fecha: _f, hora: _h, ...resto }) => resto,
            ),
            pagos,
          });
      if (!r.ok) {
        if (
          r.campo === "clienteId" ||
          r.campo === "items" ||
          r.code === "YA_COBRADA"
        ) {
          setPaso("armar");
          setMovil("venta");
          setError(r.error);
        } else setErrorPago(r.error);
        return;
      }
      void qc.invalidateQueries({ queryKey: [CLAVE_AGENDA] });
      setComprobante({
        cobro: r.cobro,
        cliente: cliente ? `${cliente.nombre} ${cliente.apellido}` : null,
        saludo: cliente?.nombre.split(" ")[0] ?? null,
        lugar:
          datos.locales.find((l) => l.id === datos.localId)?.nombre ?? null,
        telefono: cliente?.telefono ?? null,
        correo: cliente?.correo ?? null,
        medios: medios(pagos, datos.metodos),
        items: datos.saldo
          ? [
              {
                descripcion: datos.saldo.detalle,
                cantidad: 1,
                total: datos.saldo.total,
              },
            ]
          : items.map((i) => ({
              descripcion: i.descripcion,
              cantidad: i.cantidad,
              total: i.cantidad * i.precioUnitario,
            })),
        subtotal: datos.saldo ? datos.saldo.total : sub,
        descuento: datos.saldo ? 0 : desc,
        propina: pagos.reduce((s, p) => s + (p.propina ?? 0), 0),
      });
      setPaso("listo");
    });
  }

  return {
    paso,
    setPaso,
    movil,
    setMovil,
    pestana,
    setPestana,
    items,
    cliente,
    descuento,
    setDescuento,
    error,
    errorPago,
    comprobante,
    pagando,
    sub,
    desc,
    saldo,
    agregar,
    agregarProducto,
    agregarLibre,
    agregarExtra,
    cambiarItem,
    quitarItem,
    elegirCliente,
    verCatalogo,
    continuar,
    pagar,
  };
}

export type FlujoVenta = ReturnType<typeof useFlujoVenta>;
