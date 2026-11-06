import { describe, expect, it } from "vitest";
import { coincideBusqueda, coincideTexto } from "./busqueda";

const cita = {
  clienteNombre: "Mónica Pérez",
  servicioNombre: "Tinte completo",
  clienteTelefono: "+57 300 123 4567",
};

describe("búsqueda de la agenda", () => {
  it("sin texto, todo coincide", () => {
    expect(coincideBusqueda(cita, "  ")).toBe(true);
  });

  it("busca por cliente y servicio sin importar tildes ni mayúsculas", () => {
    expect(coincideBusqueda(cita, "monica")).toBe(true);
    expect(coincideBusqueda(cita, "PEREZ tinte")).toBe(true);
    expect(coincideBusqueda(cita, "monica corte")).toBe(false);
  });

  it("busca por teléfono desde 3 cifras", () => {
    expect(coincideBusqueda(cita, "4567")).toBe(true);
    expect(coincideBusqueda(cita, "300 123")).toBe(true);
    expect(coincideBusqueda(cita, "99")).toBe(false);
  });
});

describe("búsqueda: casos de la revisión", () => {
  const cita = {
    clienteNombre: "Andrea Pérez",
    servicioNombre: "Yoga matutino",
    clienteTelefono: "+573000000012",
  };
  it("el teléfono pegado con indicativo y espacios también encuentra", () => {
    expect(coincideBusqueda(cita, "+57 300 000 0012")).toBe(true);
    expect(coincideBusqueda(cita, "+57 300 000 0099")).toBe(false);
  });
  it("las clases se buscan palabra por palabra, como las citas", () => {
    expect(coincideTexto("Yoga matutino", "matutino  yoga")).toBe(true);
    expect(coincideTexto("Yoga matutino", "yoga pilates")).toBe(false);
  });
});
