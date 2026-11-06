import { describe, expect, it } from "vitest";
import {
  agrupar,
  contarNuevos,
  cuandoFue,
  esNuevo,
  filtrar,
  masNuevo,
  type Aviso,
  type TipoAviso,
} from "./avisos";

const aviso = (id: string, tipo: TipoAviso, fecha: string): Aviso => ({
  id,
  tipo,
  fecha,
  titulo: id,
  detalle: "",
  enlace: "/",
});

// Bogotá es UTC-5: 2026-11-05T03:00Z todavía es el 4 de noviembre allá.
const AVISOS = [
  aviso("r1", "reserva", "2026-11-05T15:00:00Z"),
  aviso("p1", "pago", "2026-11-05T12:00:00Z"),
  aviso("c1", "cancelacion", "2026-11-05T03:00:00Z"),
  aviso("s1", "stock", "2026-11-03T15:00:00Z"),
  aviso("e1", "espera_avisada", "2026-11-04T20:00:00Z"),
];

describe("avisos", () => {
  it("nuevos: lo que pasó después de la última vez; sin fecha, todo", () => {
    expect(esNuevo(AVISOS[0], null)).toBe(true);
    expect(contarNuevos(AVISOS, "2026-11-05T12:00:00Z")).toBe(1);
    expect(contarNuevos(AVISOS, "2026-11-05T06:00:00-05:00")).toBe(2);
    expect(masNuevo(AVISOS)).toBe("2026-11-05T15:00:00Z");
    expect(masNuevo([])).toBeNull();
  });

  it("fichas: no leídos y cada categoría", () => {
    const ids = (f: Parameters<typeof filtrar>[1]) =>
      filtrar(AVISOS, f, "2026-11-05T00:00:00Z").map((a) => a.id);
    expect(ids("todos")).toHaveLength(5);
    expect(ids("no_leidos")).toEqual(["r1", "p1", "c1"]);
    expect(ids("reservas")).toEqual(["r1", "c1"]);
    expect(ids("pagos")).toEqual(["p1"]);
    expect(ids("sistema")).toEqual(["s1", "e1"]);
  });

  it("agrupa por día en la zona del negocio", () => {
    const grupos = agrupar(AVISOS, "2026-11-05");
    expect(grupos.map((g) => [g.titulo, g.avisos.map((a) => a.id)])).toEqual([
      ["Hoy", ["r1", "p1"]],
      ["Ayer", ["c1", "e1"]],
      ["Antes", ["s1"]],
    ]);
  });

  it("cuándo fue", () => {
    const ahora = new Date("2026-11-05T15:30:00Z");
    expect(cuandoFue("2026-11-05T15:29:40Z", ahora)).toBe("Hace un momento");
    expect(cuandoFue("2026-11-05T15:00:00Z", ahora)).toBe("Hace 30 min");
    expect(cuandoFue("2026-11-05T12:00:00Z", ahora)).toBe("Hace 3 h");
    expect(cuandoFue("2026-11-05T03:00:00Z", ahora)).toBe("Ayer");
    expect(cuandoFue("2026-11-02T15:00:00Z", ahora)).toBe("2 nov");
  });
});
