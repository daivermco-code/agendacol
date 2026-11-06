import { describe, expect, it } from "vitest";
import {
  agruparPorLetra,
  clienteDesde,
  colorDe,
  COLORES_INICIALES,
  letraDe,
  type ClienteLista,
} from "./lista-celular";

const c = (id: string, nombre: string): ClienteLista => ({
  id,
  nombre,
  apellido: "Prueba",
  correo: null,
});

describe("lista A–Z del celular", () => {
  it("la letra es la primera del nombre, sin tilde; lo demás va en #", () => {
    expect(letraDe("Óscar")).toBe("O");
    expect(letraDe("  ángela")).toBe("A");
    expect(letraDe("Ñusta")).toBe("N"); // la base ordena la Ñ con la N
    expect(letraDe("3M")).toBe("#");
    expect(letraDe("")).toBe("#");
  });

  it("agrupa en el orden de llegada sin repetir secciones", () => {
    const grupos = agruparPorLetra([
      c("1", "Andrés"),
      c("2", "Ángela"),
      c("3", "Camilo"),
      c("4", "Álvaro"),
    ]);
    expect(grupos.map((g) => g.letra)).toEqual(["A", "C"]);
    expect(grupos[0].clientes.map((x) => x.id)).toEqual(["1", "2", "4"]);
  });

  it("el color depende solo del cliente", () => {
    expect(colorDe("abc")).toBe(colorDe("abc"));
    const usados = new Set(
      ["a", "b", "c", "d", "e", "f", "g", "h"].map((x) => colorDe(x)),
    );
    expect(usados.size).toBeGreaterThan(1);
    for (const col of usados) expect(COLORES_INICIALES).toContain(col);
  });

  it("cliente desde con la fecha de Bogotá", () => {
    // 1 de noviembre a las 2:00 en UTC es todavía 31 de octubre en Bogotá.
    expect(clienteDesde("2026-11-01T02:00:00Z")).toBe(
      "Cliente desde el 31/10/2026",
    );
  });
});
