import { describe, expect, it } from "vitest";
import {
  esFecha,
  etiquetaRango,
  leerDia,
  leerVista,
  periodoCelular,
} from "./periodo-celular";

const HOY = "2026-11-05"; // jueves

describe("periodoCelular", () => {
  it("hoy: un día, sin flecha siguiente, y ayer se llama Ayer", () => {
    expect(periodoCelular("hoy", HOY, HOY)).toEqual({
      desde: HOY,
      hasta: HOY,
      anterior: "2026-11-04",
      siguiente: null,
      etiqueta: "Hoy",
    });
    const ayer = periodoCelular("hoy", "2026-11-04", HOY);
    expect(ayer.etiqueta).toBe("Ayer");
    expect(ayer.siguiente).toBe(HOY);
    expect(periodoCelular("hoy", "2026-11-01", HOY).etiqueta).toBe("dom 1 nov");
  });

  it("semana: de lunes a domingo, con el mes una sola vez si no cambia", () => {
    const p = periodoCelular("semana", HOY, HOY);
    expect(p).toMatchObject({
      desde: "2026-11-02",
      hasta: "2026-11-08",
      anterior: "2026-10-26",
      siguiente: null,
      etiqueta: "2 – 8 nov",
    });
    const antes = periodoCelular("semana", p.anterior, HOY);
    expect(antes).toMatchObject({
      desde: "2026-10-26",
      hasta: "2026-11-01",
      siguiente: "2026-11-02",
      etiqueta: "26 oct – 1 nov",
    });
  });

  it("mes: completo, y el anterior abre en su día 1", () => {
    expect(periodoCelular("mes", HOY, HOY)).toMatchObject({
      desde: "2026-11-01",
      hasta: "2026-11-30",
      anterior: "2026-10-01",
      siguiente: null,
      etiqueta: "noviembre de 2026",
    });
    expect(periodoCelular("mes", "2026-10-01", HOY)).toMatchObject({
      hasta: "2026-10-31",
      siguiente: "2026-11-01",
    });
  });

  it("los años que no son el de hoy se escriben", () => {
    expect(periodoCelular("semana", "2025-12-30", HOY).etiqueta).toBe(
      "29 dic 2025 – 4 ene 2026",
    );
    expect(periodoCelular("hoy", "2025-12-30", HOY).etiqueta).toBe(
      "mar 30 dic 2025",
    );
  });
});

describe("lectura de la dirección", () => {
  it("vista desconocida es hoy; un día futuro o mal escrito también", () => {
    expect(leerVista("mes")).toBe("mes");
    expect(leerVista("año")).toBe("hoy");
    expect(leerDia("2026-11-06", HOY)).toBe(HOY);
    expect(leerDia("5-11-2026", HOY)).toBe(HOY);
    expect(leerDia("2026-10-20", HOY)).toBe("2026-10-20");
  });

  it("una fecha que no existe en el calendario vuelve a hoy", () => {
    expect(leerDia("2026-02-30", HOY)).toBe(HOY);
    expect(leerDia("2025-13-01", HOY)).toBe(HOY);
    expect(leerDia("2026-00-10", HOY)).toBe(HOY);
    expect(esFecha("2024-02-29")).toBe(true);
    expect(esFecha("2026-02-29")).toBe(false);
  });

  it("el rango libre se lee corto", () => {
    expect(etiquetaRango("2026-10-01", "2026-11-04", HOY)).toBe(
      "1 oct – 4 nov",
    );
    expect(etiquetaRango(HOY, HOY, HOY)).toBe("jue 5 nov");
    expect(etiquetaRango("2025-03-04", "2025-03-04", HOY)).toBe(
      "mar 4 mar 2025",
    );
  });
});
