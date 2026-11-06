import { describe, expect, it } from "vitest";
import { pasoDeslizar, type Gesto } from "./deslizar";

const g = (cambio: Partial<Gesto>): Gesto => ({
  dx: -120,
  dy: 10,
  ms: 200,
  alInicio: true,
  alFinal: true,
  ...cambio,
});

describe("deslizar de lado", () => {
  it("a la izquierda va al siguiente y a la derecha al anterior", () => {
    expect(pasoDeslizar(g({}))).toBe(1);
    expect(pasoDeslizar(g({ dx: 120 }))).toBe(-1);
  });

  it("no cuenta si es corto, lento o más vertical que horizontal", () => {
    expect(pasoDeslizar(g({ dx: -40 }))).toBeNull();
    expect(pasoDeslizar(g({ ms: 600 }))).toBeNull();
    expect(pasoDeslizar(g({ dy: 100 }))).toBeNull();
  });

  it("mientras la cuadrícula se pueda desplazar hacia ese lado, se desplaza ella", () => {
    expect(pasoDeslizar(g({ alFinal: false }))).toBeNull();
    expect(pasoDeslizar(g({ dx: 120, alInicio: false }))).toBeNull();
    expect(pasoDeslizar(g({ dx: 120, alFinal: false }))).toBe(-1);
  });
});
