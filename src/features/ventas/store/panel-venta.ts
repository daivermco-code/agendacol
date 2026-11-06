"use client";

import { create } from "zustand";

/** Qué se cobra al abrir el panel: citas (con su cliente), una venta con saldo, o una venta en blanco. */
export interface PedidoVenta {
  citaIds?: string[];
  clienteId?: string;
  /** Venta en "Pago parcial": el panel va directo a pagar el saldo. */
  ventaId?: string;
}

/**
 * De dónde se abrió la venta: decide el botón de vuelta del comprobante en el celular.
 * Va aparte del pedido, que es la clave de la consulta y viaja al servidor.
 */
export type OrigenVenta =
  { tipo: "agenda" } | { tipo: "cita"; citaId: string } | { tipo: "ventas" };

interface EstadoPanelVenta {
  pedido: PedidoVenta | null;
  origen: OrigenVenta | null;
  /** Venta abierta en la ventana "ver venta". */
  viendo: string | null;
  /** Cita que se vuelve a abrir después de cobrarla ("Volver a la cita"). */
  volverACita: string | null;
  /**
   * Salida con confirmación que registra la venta en curso (el carrito del celular con ítems): la X y Escape
   * pasan por aquí en vez de vaciar la venta sin preguntar.
   */
  salida: (() => void) | null;
  setSalida: (salida: (() => void) | null) => void;
  abrir: (p?: PedidoVenta, origen?: OrigenVenta | null) => void;
  cerrar: () => void;
  /** Cierra el panel y, si vino de una cita, pide abrirla de nuevo. */
  volver: () => void;
  ver: (ventaId: string | null) => void;
  limpiarVuelta: () => void;
}

/** Un solo panel de venta para toda la app (agenda, ficha del cliente, Ventas y Mis cobros). */
export const usePanelVenta = create<EstadoPanelVenta>((set) => ({
  pedido: null,
  origen: null,
  viendo: null,
  volverACita: null,
  salida: null,
  setSalida: (salida) => set({ salida }),
  abrir: (p = {}, origen = null) =>
    set({ pedido: p, origen, viendo: null, volverACita: null, salida: null }),
  cerrar: () => set({ pedido: null, salida: null }),
  volver: () =>
    set((e) => ({
      pedido: null,
      salida: null,
      volverACita: e.origen?.tipo === "cita" ? e.origen.citaId : null,
    })),
  ver: (ventaId) => set({ viendo: ventaId }),
  limpiarVuelta: () => set({ volverACita: null }),
}));
