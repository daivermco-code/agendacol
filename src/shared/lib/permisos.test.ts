import { describe, expect, it } from "vitest";
import { permisoDeRuta, puede, puedeVerRuta } from "./permisos";

describe("puede", () => {
  it("el dueño puede todo", () => {
    expect(puede("dueno", "editar_ajustes")).toBe(true);
    expect(puede("dueno", "ver_caja")).toBe(true);
    expect(puede("dueno", "reiniciar_demo")).toBe(true);
  });

  it("recepción agenda, cobra y ve clientes, pero no administra", () => {
    expect(puede("recepcion", "crear_cita")).toBe(true);
    expect(puede("recepcion", "cobrar")).toBe(true);
    expect(puede("recepcion", "ver_contactos")).toBe(true);
    expect(puede("recepcion", "administrar")).toBe(false);
    expect(puede("recepcion", "editar_ajustes")).toBe(false);
    expect(puede("recepcion", "gestionar_usuarios")).toBe(false);
    expect(puede("recepcion", "ver_caja")).toBe(false);
    expect(puede("recepcion", "anular_venta")).toBe(false);
    expect(puede("recepcion", "ver_reportes_ventas")).toBe(false);
    expect(puede("recepcion", "reiniciar_demo")).toBe(false);
  });

  it("el profesional solo ve su agenda y cambia estados", () => {
    expect(puede("profesional", "ver_agenda")).toBe(true);
    expect(puede("profesional", "cambiar_estado_cita")).toBe(true);
    expect(puede("profesional", "ver_agenda_completa")).toBe(false);
    expect(puede("profesional", "crear_cita")).toBe(false);
    expect(puede("profesional", "ver_contactos")).toBe(false);
    expect(puede("profesional", "cobrar")).toBe(false);
    expect(puede("profesional", "ver_resumen")).toBe(false);
  });

  it("sin rol no puede nada", () => {
    expect(puede(null, "ver_agenda")).toBe(false);
    expect(puede(undefined, "ver_agenda")).toBe(false);
  });
});

describe("rutas", () => {
  it("la caja pide su propio permiso aunque esté dentro de ventas", () => {
    expect(permisoDeRuta("/ventas/caja")).toBe("ver_caja");
    expect(permisoDeRuta("/ventas/detalle")).toBe("ver_ventas");
  });

  it("no confunde prefijos parecidos", () => {
    expect(permisoDeRuta("/ventasx")).toBeNull();
    expect(permisoDeRuta("/agenda")).toBe("ver_agenda");
  });

  it("recepción no entra a administración, ajustes, usuarios ni caja", () => {
    for (const ruta of [
      "/administracion/servicios",
      "/ajustes/agenda",
      "/usuarios",
      "/ventas/caja",
    ]) {
      expect(puedeVerRuta("recepcion", ruta)).toBe(false);
    }
    expect(puedeVerRuta("recepcion", "/ventas/detalle")).toBe(true);
    expect(puedeVerRuta("recepcion", "/reportes/reservas")).toBe(true);
    expect(puedeVerRuta("recepcion", "/reportes/ventas")).toBe(false);
  });

  it("el centro de Ajustes es para todos; sus secciones, solo para el dueño", () => {
    expect(permisoDeRuta("/ajustes")).toBeNull();
    for (const rol of ["dueno", "recepcion", "profesional"] as const) {
      expect(puedeVerRuta(rol, "/ajustes")).toBe(true);
    }
    expect(puedeVerRuta(null, "/ajustes")).toBe(false);
    expect(permisoDeRuta("/ajustes/mi-negocio")).toBe("editar_ajustes");
    expect(puedeVerRuta("recepcion", "/ajustes/mi-negocio")).toBe(false);
  });

  it("el profesional solo entra a la agenda", () => {
    expect(puedeVerRuta("profesional", "/agenda")).toBe(true);
    expect(puedeVerRuta("profesional", "/clientes")).toBe(false);
    expect(puedeVerRuta("profesional", "/")).toBe(false);
  });
});
