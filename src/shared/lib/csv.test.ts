import { describe, expect, it } from "vitest";
import { aCsv, celdaCsv, columnasElegidas } from "./csv";

describe("celdaCsv", () => {
  it("deja el texto y los números tal cual", () => {
    expect(celdaCsv("Laura Gómez")).toBe("Laura Gómez");
    expect(celdaCsv(38000)).toBe("38000");
    expect(celdaCsv(-2)).toBe("-2");
    expect(celdaCsv(null)).toBe("");
  });

  it("encierra entre comillas lo que tiene ; comillas o saltos", () => {
    expect(celdaCsv("Corte; barba")).toBe('"Corte; barba"');
    expect(celdaCsv('Dijo "hola"')).toBe('"Dijo ""hola"""');
    expect(celdaCsv("dos\nlíneas")).toBe('"dos\nlíneas"');
  });

  it("neutraliza las fórmulas (inyección CSV)", () => {
    expect(celdaCsv("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(celdaCsv("+57 300")).toBe("'+57 300");
    expect(celdaCsv("-1")).toBe("'-1");
    expect(celdaCsv("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(celdaCsv("=1;2")).toBe('"\'=1;2"');
  });
});

describe("aCsv", () => {
  it("lleva la marca UTF-8, punto y coma y saltos de Windows", () => {
    const csv = aCsv(
      [{ nombre: "Nombre" }, { nombre: "Total" }],
      [["Ana", 1000]],
    );
    expect(csv).toBe("﻿Nombre;Total\r\nAna;1000\r\n");
  });
});

describe("columnasElegidas", () => {
  const todas = [
    { clave: "numero", nombre: "ID", fija: true },
    { clave: "fecha", nombre: "Fecha" },
    { clave: "pagado", nombre: "Pagado", oculta: true },
  ];

  it("sin pedido: las visibles por defecto", () => {
    expect(columnasElegidas(todas, null).map((c) => c.clave)).toEqual([
      "numero",
      "fecha",
    ]);
  });

  it("con pedido: las pedidas en el orden del listado, más las fijas", () => {
    expect(
      columnasElegidas(todas, ["pagado", "nada"]).map((c) => c.clave),
    ).toEqual(["numero", "pagado"]);
  });
});
