import { describe, expect, it } from "vitest";
import { enlaceWhatsapp, textoComprobante } from "./comprobante";

const base = {
  nombre: "Andrea",
  lugar: "Salón Ceiba",
  numero: "1042",
  items: [
    { descripcion: "Corte", cantidad: 1 },
    { descripcion: "Champú", cantidad: 2 },
  ],
  total: 70000,
  pagado: 70000,
};

describe("textoComprobante", () => {
  it("saluda, lista lo comprado con la cantidad y da el total", () => {
    const t = textoComprobante(base);
    expect(t).toContain("Hola Andrea,");
    expect(t).toContain("venta 1042 en Salón Ceiba");
    expect(t).toContain("Corte, Champú x2.");
    expect(t).toMatch(/Total \$\s?70\.000\./);
    expect(t).not.toContain("Saldo");
  });

  it("sin cliente ni lugar no deja huecos, y un abono dice el saldo", () => {
    const t = textoComprobante({
      ...base,
      nombre: null,
      lugar: null,
      pagado: 20000,
    });
    expect(t.startsWith("Hola, este es")).toBe(true);
    expect(t).toContain("venta 1042:");
    expect(t).toMatch(/Saldo pendiente \$\s?50\.000\./);
  });
});

describe("enlaceWhatsapp", () => {
  it("deja solo los dígitos del teléfono y codifica el texto", () => {
    expect(enlaceWhatsapp("+57 300 000 0001", "Hola & gracias")).toBe(
      "https://wa.me/573000000001?text=Hola%20%26%20gracias",
    );
  });

  it("sin teléfono abre WhatsApp para elegir el contacto", () => {
    expect(enlaceWhatsapp(null, "Hola")).toBe("https://wa.me/?text=Hola");
  });
});
