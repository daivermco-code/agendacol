import type { CuentaSellos } from "./lib/sellos";

export interface TarjetaSellos extends CuentaSellos {
  clienteId: string;
  cliente: string;
  telefono: string | null;
  sellos: number;
  canjes: number;
  ultimo: string;
}

export interface PanelSellos {
  clientes: number;
  sellosMes: number;
  porEntregar: number;
  entregados: number;
  /** Les falta un sello para el premio. */
  aUnSello: number;
}
