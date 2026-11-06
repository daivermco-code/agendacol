import { describe, expect, it } from "vitest";
import {
  agruparPorDia,
  enBogota,
  metodoPrincipal,
  resumenVentas,
  valorVenta,
  type VentaCelular,
} from "./lista-celular";

function venta(
  id: string,
  fecha: string,
  total: number,
  estado: VentaCelular["estado"] = "pagada",
): VentaCelular {
  return {
    id,
    numero: id,
    fecha,
    total,
    pagado: total,
    estado,
    cliente: "Ana",
    pagos: [],
  };
}

describe("enBogota", () => {
  it("las 2 a. m. UTC todavía son el día anterior en Bogotá", () => {
    expect(enBogota("2026-11-05T02:30:00+00:00")).toEqual({
      dia: "2026-11-04",
      hora: "21:30",
    });
  });
});

describe("metodoPrincipal", () => {
  it("un método, varios o ninguno", () => {
    expect(metodoPrincipal([])).toEqual({ nombre: "Sin pago", tipo: null });
    expect(
      metodoPrincipal([
        { monto: 1, metodo: "Efectivo", tipo: "efectivo" },
        { monto: 2, metodo: "Efectivo", tipo: "efectivo" },
      ]),
    ).toEqual({ nombre: "Efectivo", tipo: "efectivo" });
    expect(
      metodoPrincipal([
        { monto: 1, metodo: "Efectivo", tipo: "efectivo" },
        { monto: 2, metodo: "Nequi", tipo: "billetera" },
      ]),
    ).toEqual({ nombre: "Varios", tipo: "otro" });
  });
});

describe("agruparPorDia y resumenVentas", () => {
  const filas = [
    venta("3", "2026-11-05T15:00:00+00:00", 30000),
    venta("2", "2026-11-05T13:00:00+00:00", 20000, "anulada"),
    venta("1", "2026-11-05T01:00:00+00:00", 10000),
  ];

  it("agrupa por día de Bogotá, marca hoy y no suma las anuladas", () => {
    const g = agruparPorDia(filas, "2026-11-05", valorVenta);
    expect(g.map((x) => [x.dia, x.total, x.filas.length, x.esHoy])).toEqual([
      ["2026-11-05", 30000, 2, true],
      ["2026-11-04", 10000, 1, false],
    ]);
    expect(g[0].titulo).toBe("jueves, 5 de noviembre");
    expect(agruparPorDia(filas, "2027-01-02", valorVenta)[0].titulo).toBe(
      "jueves, 5 de noviembre de 2026",
    );
  });

  it("el total y N dejan fuera las anuladas", () => {
    expect(resumenVentas(filas)).toEqual({ total: 40000, n: 2 });
  });
});
