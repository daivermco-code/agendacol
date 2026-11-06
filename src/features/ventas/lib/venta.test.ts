import { describe, expect, it } from "vitest";
import {
  descuentoEnPesos,
  leerPesos,
  revisarPagos,
  subtotal,
  sumaPagos,
  vuelto,
} from "./venta";

const efectivo = (monto: number, recibido?: number) => ({
  monto,
  recibido: recibido ?? null,
  efectivo: true,
});
const tarjeta = (monto: number) => ({ monto, efectivo: false });

describe("cuentas de la venta", () => {
  it("suma cantidad por precio", () => {
    expect(
      subtotal([
        { cantidad: 2, precioUnitario: 35_000 },
        { cantidad: 1, precioUnitario: 20_000 },
      ]),
    ).toBe(90_000);
    expect(subtotal([])).toBe(0);
  });

  it("el descuento nunca pasa del subtotal y el porcentaje se redondea", () => {
    expect(descuentoEnPesos(90_000, "pesos", 10_000)).toBe(10_000);
    expect(descuentoEnPesos(90_000, "pesos", 120_000)).toBe(90_000);
    expect(descuentoEnPesos(35_000, "porcentaje", 15)).toBe(5_250);
    expect(descuentoEnPesos(33_333, "porcentaje", 10)).toBe(3_333);
    expect(descuentoEnPesos(35_000, "porcentaje", 250)).toBe(35_000);
    expect(descuentoEnPesos(35_000, "pesos", -5)).toBe(0);
    expect(descuentoEnPesos(35_000, "pesos", Number.NaN)).toBe(0);
  });

  it("el vuelto sale solo del efectivo recibido de más", () => {
    expect(vuelto([efectivo(35_000, 50_000)])).toBe(15_000);
    expect(vuelto([efectivo(35_000)])).toBe(0);
    expect(vuelto([efectivo(20_000, 30_000), tarjeta(15_000)])).toBe(10_000);
    expect(sumaPagos([efectivo(20_000, 30_000), tarjeta(15_000)])).toBe(35_000);
  });

  it("lee montos escritos con puntos, signo o espacios", () => {
    expect(leerPesos("45.000")).toBe(45_000);
    expect(leerPesos("$ 45 000")).toBe(45_000);
    expect(leerPesos("")).toBeNull();
    expect(leerPesos("abc")).toBeNull();
  });
});

describe("revisarPagos", () => {
  it("paga justo en efectivo con vuelto", () => {
    expect(revisarPagos(35_000, [efectivo(35_000, 50_000)], false)).toEqual({
      ok: true,
      suma: 35_000,
      falta: 0,
      vuelto: 15_000,
      abono: false,
    });
  });

  it("la propina sale del vuelto y lo recibido la tiene que cubrir (0019)", () => {
    const conPropina = {
      monto: 35_000,
      recibido: 50_000,
      efectivo: true,
      propina: 5_000,
    };
    expect(revisarPagos(35_000, [conPropina], false)).toMatchObject({
      ok: true,
      suma: 35_000,
      vuelto: 10_000,
    });
    expect(
      revisarPagos(35_000, [{ ...conPropina, recibido: 38_000 }], false),
    ).toMatchObject({ ok: false, error: "El monto recibido no alcanza" });
    expect(
      revisarPagos(35_000, [{ ...conPropina, propina: -1 }], false),
    ).toMatchObject({ ok: false, error: "Revisa la propina" });
  });

  it("el efectivo recibido menor al monto no alcanza", () => {
    expect(
      revisarPagos(35_000, [efectivo(35_000, 30_000)], false),
    ).toMatchObject({
      ok: false,
      error: "El monto recibido no alcanza",
      campo: "recibido",
    });
  });

  it("varios métodos deben completar el total salvo que sea abono", () => {
    expect(
      revisarPagos(90_000, [tarjeta(50_000), efectivo(30_000)], false),
    ).toMatchObject({
      ok: false,
      error: "Falta por pagar $10.000",
    });
    expect(
      revisarPagos(90_000, [tarjeta(50_000), efectivo(30_000)], true),
    ).toMatchObject({
      ok: true,
      falta: 10_000,
      abono: true,
    });
  });

  it("los pagos no pueden superar el total", () => {
    expect(
      revisarPagos(35_000, [tarjeta(20_000), tarjeta(20_000)], false),
    ).toMatchObject({
      ok: false,
      error: "Los pagos superan el total",
    });
  });

  it("pide al menos un método y montos mayores a cero", () => {
    expect(revisarPagos(35_000, [], false)).toMatchObject({
      error: "Elige cómo paga el cliente",
    });
    expect(revisarPagos(35_000, [tarjeta(0)], false)).toMatchObject({
      error: "Escribe un monto mayor a cero",
    });
    expect(revisarPagos(0, [], false)).toMatchObject({ ok: true, suma: 0 });
  });
});
