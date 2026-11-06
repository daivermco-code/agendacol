import { describe, expect, it } from "vitest";
import { esErrorDeRed, mensajeDeError, SIN_RED_NO_GUARDO } from "./red";

describe("esErrorDeRed", () => {
  it("reconoce lo que dice fetch sin red en cada navegador", () => {
    expect(esErrorDeRed(new TypeError("Failed to fetch"))).toBe(true);
    expect(esErrorDeRed(new TypeError("Load failed"))).toBe(true);
    expect(
      esErrorDeRed(
        new TypeError("NetworkError when attempting to fetch resource."),
      ),
    ).toBe(true);
    expect(esErrorDeRed("Failed to fetch")).toBe(true);
  });

  it("no confunde un error del servidor ni cosas que no son errores", () => {
    expect(esErrorDeRed(new Error("La cita ya no existe"))).toBe(false);
    expect(esErrorDeRed(null)).toBe(false);
    expect(esErrorDeRed(undefined)).toBe(false);
    expect(esErrorDeRed({ message: 42 })).toBe(false);
  });
});

describe("mensajeDeError", () => {
  it("sin red dice que no se guardó; si no, el mensaje del error", () => {
    expect(mensajeDeError(new TypeError("Failed to fetch"))).toBe(
      SIN_RED_NO_GUARDO,
    );
    expect(mensajeDeError(new Error("Esta cita está cancelada"))).toBe(
      "Esta cita está cancelada",
    );
    expect(mensajeDeError(new Error(""), "Otro")).toBe("Otro");
  });
});
