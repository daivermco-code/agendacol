import { describe, expect, it } from "vitest";
import type { ProfesionalPublico, ServicioPublico } from "../types";
import { aUtc, crearIcs, enlaceMapa } from "./calendario";
import {
  agruparHoras,
  enlacePaso,
  expandir,
  leerLineas,
  leerSeleccion,
  profesionalesPara,
  sumarMinutos,
  totales,
} from "./seleccion";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const P = "33333333-3333-4333-8333-333333333333";

function servicio(
  id: string,
  duracion: number,
  precio: number | null,
): ServicioPublico {
  return {
    id,
    nombre: id,
    descripcion: null,
    categoria: "C",
    duracion,
    mostrarDuracion: true,
    precio,
    imagen: null,
  };
}
const SERVICIOS = [servicio(A, 45, 40000), servicio(B, 30, null)];

describe("selección del sitio de reservas", () => {
  it("lee los servicios de la dirección y descarta lo que no existe o se repite", () => {
    expect(leerLineas(`${A}:2,${B}:1,otro:3,${A}:1`, SERVICIOS)).toEqual([
      { id: A, cantidad: 2 },
      { id: B, cantidad: 1 },
    ]);
    expect(leerLineas(`${A}:9`, SERVICIOS)).toEqual([{ id: A, cantidad: 6 }]);
    expect(leerLineas(`${A}:0`, SERVICIOS)).toEqual([]);
    expect(leerLineas(undefined, SERVICIOS)).toEqual([]);
  });

  it("valida profesional, fecha y hora", () => {
    const sel = leerSeleccion(
      { s: `${A}:1`, p: P, f: "2026-12-07", h: "10:30" },
      SERVICIOS,
    );
    expect(sel).toMatchObject({
      profesionalId: P,
      fecha: "2026-12-07",
      hora: "10:30",
    });
    expect(
      leerSeleccion({ p: "x", f: "2026-13-01", h: "10:15" }, SERVICIOS),
    ).toMatchObject({
      profesionalId: null,
      fecha: null,
      hora: null,
    });
  });

  it("arma el enlace de cada paso y vuelve a leerlo igual", () => {
    const lineas = [{ id: A, cantidad: 2 }];
    const url = enlacePaso("salon-ceiba", "datos", {
      lineas,
      profesionalId: P,
      fecha: "2026-12-07",
      hora: "09:00",
    });
    expect(url).toBe(
      `/reservar/salon-ceiba/datos?s=${encodeURIComponent(`${A}:2`)}&p=${P}&f=2026-12-07&h=09%3A00`,
    );
    expect(enlacePaso("salon-ceiba", "", {})).toBe("/reservar/salon-ceiba");
    expect(expandir(lineas)).toEqual([A, A]);
  });

  it("suma duración y precio, y avisa si un precio no se muestra", () => {
    expect(totales([{ id: A, cantidad: 2 }], SERVICIOS)).toEqual({
      unidades: 2,
      minutos: 90,
      precio: 80000,
      precioCompleto: true,
    });
    expect(totales([{ id: B, cantidad: 1 }], SERVICIOS).precioCompleto).toBe(
      false,
    );
  });

  it("solo ofrece profesionales que hacen todos los servicios", () => {
    const profesionales: ProfesionalPublico[] = [
      { id: "x", nombre: "X", foto: null, color: null, servicios: [A, B] },
      { id: "y", nombre: "Y", foto: null, color: null, servicios: [A] },
    ];
    expect(
      profesionalesPara([{ id: A, cantidad: 1 }], profesionales),
    ).toHaveLength(2);
    expect(
      profesionalesPara(
        [
          { id: A, cantidad: 1 },
          { id: B, cantidad: 1 },
        ],
        profesionales,
      ).map((p) => p.id),
    ).toEqual(["x"]);
  });

  it("agrupa las horas en mañana, tarde y noche", () => {
    expect(agruparHoras(["09:00", "11:30", "12:00", "17:30", "18:00"])).toEqual(
      {
        manana: ["09:00", "11:30"],
        tarde: ["12:00", "17:30"],
        noche: ["18:00"],
      },
    );
    expect(sumarMinutos("09:30", 90)).toBe("11:00");
  });
});

describe("calendario y mapa", () => {
  it("pasa la hora de Bogotá a UTC", () => {
    expect(aUtc("2026-12-07", "10:00", "America/Bogota").toISOString()).toBe(
      "2026-12-07T15:00:00.000Z",
    );
    expect(aUtc("2026-07-01", "09:30", "Europe/Madrid").toISOString()).toBe(
      "2026-07-01T07:30:00.000Z",
    );
  });

  it("crea un .ics válido con los textos escapados", () => {
    const ics = crearIcs(
      {
        uid: "abc@agedacol.demo",
        fecha: "2026-12-07",
        inicio: "10:00",
        fin: "11:30",
        zona: "America/Bogota",
        titulo: "Corte de dama, en Salón Ceiba",
        lugar: "Calle 63 # 9-45; Bogotá",
      },
      new Date("2026-10-31T12:00:00Z"),
    );
    expect(ics).toContain("DTSTART:20261207T150000Z\r\n");
    expect(ics).toContain("DTEND:20261207T163000Z\r\n");
    expect(ics).toContain("SUMMARY:Corte de dama\\, en Salón Ceiba");
    expect(ics).toContain("LOCATION:Calle 63 # 9-45\\; Bogotá");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
  });

  it("arma el enlace del mapa sin llave", () => {
    expect(enlaceMapa("Calle 63 # 9-45, Bogotá")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Calle%2063%20%23%209-45%2C%20Bogot%C3%A1",
    );
  });
});
