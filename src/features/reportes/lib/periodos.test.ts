import { describe, expect, it } from "vitest";
import {
  leerPeriodo,
  periodoComparado,
  porcentaje,
  textoPeriodo,
  variacion,
} from "./periodos";

const DEFECTO = { desde: "2026-10-26", hasta: "2026-10-31" };

describe("periodoComparado", () => {
  it("el anterior tiene el mismo largo y termina el día antes", () => {
    expect(periodoComparado("2026-10-02", "2026-10-31", "anterior")).toEqual({
      desde: "2026-09-02",
      hasta: "2026-10-01",
    });
    expect(periodoComparado("2026-10-31", "2026-10-31", "anterior")).toEqual({
      desde: "2026-10-30",
      hasta: "2026-10-30",
    });
  });

  it("un mes (o lo que va del mes) se compara con los mismos días del mes anterior", () => {
    expect(periodoComparado("2026-10-01", "2026-10-31", "anterior")).toEqual({
      desde: "2026-09-01",
      hasta: "2026-09-30",
    });
    expect(periodoComparado("2026-03-01", "2026-03-31", "anterior")).toEqual({
      desde: "2026-02-01",
      hasta: "2026-02-28",
    });
    expect(periodoComparado("2026-10-01", "2026-10-15", "anterior")).toEqual({
      desde: "2026-09-01",
      hasta: "2026-09-15",
    });
  });

  it("el del año pasado son las mismas fechas; sin comparar es null", () => {
    expect(periodoComparado("2026-10-01", "2026-10-31", "anio")).toEqual({
      desde: "2025-10-01",
      hasta: "2025-10-31",
    });
    expect(periodoComparado("2026-10-01", "2026-10-31", "ninguna")).toBeNull();
  });
});

describe("leerPeriodo", () => {
  it("sin fechas o con fechas malas usa el período por defecto", () => {
    expect(leerPeriodo({}, DEFECTO)).toMatchObject({
      ...DEFECTO,
      comparar: "anterior",
    });
    expect(
      leerPeriodo(
        { desde: "2026-13-40", hasta: "x", comparar: "otro" },
        DEFECTO,
      ),
    ).toMatchObject({ ...DEFECTO, comparar: "anterior" });
  });

  it("ordena fechas al revés y no pasa de un año", () => {
    expect(
      leerPeriodo({ desde: "2026-10-31", hasta: "2026-10-01" }, DEFECTO),
    ).toMatchObject({ desde: "2026-10-01", hasta: "2026-10-31" });
    expect(
      leerPeriodo({ desde: "2020-01-01", hasta: "2026-10-31" }, DEFECTO),
    ).toMatchObject({ desde: "2025-10-31", hasta: "2026-10-31" });
  });
});

describe("cifras", () => {
  it("variación con un decimal y null cuando antes era cero", () => {
    expect(variacion(120, 100)).toBe(20);
    expect(variacion(1, 3)).toBe(-66.7);
    expect(variacion(5, 0)).toBeNull();
  });

  it("porcentaje sin dividir por cero", () => {
    expect(porcentaje(1, 3)).toBe(33.3);
    expect(porcentaje(4, 0)).toBe(0);
  });

  it("texto del período", () => {
    expect(textoPeriodo("2026-10-02", "2026-10-31")).toBe(
      "2 oct – 31 oct 2026",
    );
    expect(textoPeriodo("2025-12-15", "2026-01-14")).toBe(
      "15 dic 2025 – 14 ene 2026",
    );
  });
});
