import { describe, expect, it } from "vitest";
import {
  ajustesPara,
  centroPara,
  MENU,
  OTRAS_RUTAS,
  pestanaActiva,
  pestanasPara,
} from "./menu";

const claves = (rol: Parameters<typeof pestanasPara>[0]) =>
  pestanasPara(rol).map((p) => p.clave);

describe("pestañas del celular", () => {
  it("cada rol ve las que ya puede abrir hoy", () => {
    expect(claves("dueno")).toEqual([
      "inicio",
      "agenda",
      "clientes",
      "ventas",
      "ajustes",
    ]);
    expect(claves("recepcion")).toEqual([
      "inicio",
      "agenda",
      "clientes",
      "ventas",
      "ajustes",
    ]);
    expect(claves("profesional")).toEqual(["agenda", "ajustes"]);
  });

  it("marca la pestaña de la ruta; lo que se abre desde Ajustes queda en Ajustes", () => {
    expect(pestanaActiva("/")).toBe("inicio");
    expect(pestanaActiva("/avisos")).toBe("inicio");
    expect(pestanaActiva("/agenda")).toBe("agenda");
    expect(pestanaActiva("/clientes")).toBe("clientes");
    expect(
      pestanaActiva("/clientes/0b8c2f4e-1a2b-4c3d-8e9f-001122334455"),
    ).toBe("clientes");
    expect(pestanaActiva("/clientes/fidelizacion")).toBe("ajustes");
    expect(pestanaActiva("/ventas/detalle")).toBe("ventas");
    expect(pestanaActiva("/ventas/caja")).toBe("ajustes");
    expect(pestanaActiva("/ajustes")).toBe("ajustes");
    expect(pestanaActiva("/administracion/servicios")).toBe("ajustes");
  });
});

describe("centro de Ajustes", () => {
  const rutas = (rol: Parameters<typeof centroPara>[0]) =>
    centroPara(rol).flatMap((g) => g.opciones.map((o) => o.href));

  it("al dueño no le falta ninguna pantalla del menú, salvo las que son pestaña", () => {
    const pestanas = new Set(["/", "/agenda", "/clientes", "/ventas/detalle"]);
    const todas = [
      ...MENU.flatMap((s) =>
        s.href ? [s.href] : s.opciones.map((o) => o.href),
      ),
      ...ajustesPara("dueno").map((o) => o.href),
      ...OTRAS_RUTAS.map((o) => o.href),
    ].filter((h) => !pestanas.has(h));
    expect(new Set(rutas("dueno"))).toEqual(new Set(todas));
  });

  it("recepción no ve administración, ajustes de la empresa, usuarios ni caja", () => {
    const r = rutas("recepcion");
    expect(r).toContain("/ventas/transacciones");
    expect(r).toContain("/demo/buzon");
    for (const h of [
      "/ajustes/mi-negocio",
      "/administracion/servicios",
      "/usuarios",
      "/ventas/caja",
      "/primeros-pasos",
    ]) {
      expect(r).not.toContain(h);
    }
  });

  it("el profesional ve solo la ayuda", () => {
    expect(centroPara("profesional").map((g) => g.nombre)).toEqual(["Ayuda"]);
    expect(rutas("profesional")).toEqual(["/buscar", "/ayuda", "/perfil"]);
  });
});
