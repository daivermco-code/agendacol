import { beforeEach, describe, expect, it } from "vitest";
import { usePanelVenta } from "./panel-venta";

const estado = () => usePanelVenta.getState();

describe("panel de venta: la vuelta del comprobante", () => {
  beforeEach(() => estado().cerrar());

  it("desde una cita, «Volver» cierra y pide abrir esa cita", () => {
    estado().abrir({ citaIds: ["c1"] }, { tipo: "cita", citaId: "c1" });
    estado().volver();
    expect(estado().pedido).toBeNull();
    expect(estado().volverACita).toBe("c1");
    estado().limpiarVuelta();
    expect(estado().volverACita).toBeNull();
  });

  it("desde la agenda o Ventas, «Volver» solo cierra", () => {
    for (const origen of [{ tipo: "agenda" }, { tipo: "ventas" }] as const) {
      estado().abrir({}, origen);
      estado().volver();
      expect(estado().pedido).toBeNull();
      expect(estado().volverACita).toBeNull();
    }
  });

  it("abrir otra venta borra una vuelta pendiente y la salida registrada", () => {
    estado().abrir({}, { tipo: "cita", citaId: "c1" });
    estado().volver();
    estado().setSalida(() => {});
    estado().abrir({});
    expect(estado().volverACita).toBeNull();
    expect(estado().salida).toBeNull();
  });
});
