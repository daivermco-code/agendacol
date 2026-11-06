import { describe, expect, it } from "vitest";
import {
  ahoraEnZona,
  aHora,
  aMinutos,
  diaSemana,
  moverAncla,
  rangoDeVista,
  tituloCorto,
  tituloRango,
} from "./fechas";
import { caja, escalaVisible, filas, minutoEn, pxPorMinuto } from "./geometria";
import { repartir } from "./reparto";

const t = (id: string, inicio: string, fin: string) => ({
  id,
  inicio: aMinutos(inicio),
  fin: aMinutos(fin),
});

describe("reparto de citas que se cruzan", () => {
  it("una sola cita ocupa todo el ancho", () => {
    expect(repartir([t("a", "09:00", "10:00")]).get("a")).toEqual({
      columna: 0,
      columnas: 1,
    });
  });

  it("dos que se cruzan van lado a lado", () => {
    const r = repartir([t("a", "09:00", "10:00"), t("b", "09:30", "10:30")]);
    expect(r.get("a")).toEqual({ columna: 0, columnas: 2 });
    expect(r.get("b")).toEqual({ columna: 1, columnas: 2 });
  });

  it("las que solo se tocan no se cruzan", () => {
    const r = repartir([t("a", "09:00", "10:00"), t("b", "10:00", "11:00")]);
    expect(r.get("a")?.columnas).toBe(1);
    expect(r.get("b")?.columnas).toBe(1);
  });

  it("reusa la primera columna libre", () => {
    const r = repartir([
      t("a", "09:00", "10:00"),
      t("b", "09:15", "11:00"),
      t("c", "10:00", "10:30"),
    ]);
    expect(r.get("c")).toEqual({ columna: 0, columnas: 2 });
  });

  it("tres a la vez son tres columnas", () => {
    const r = repartir([
      t("a", "09:00", "10:00"),
      t("b", "09:00", "10:00"),
      t("c", "09:30", "09:45"),
    ]);
    expect(new Set([...r.values()].map((u) => u.columna))).toEqual(
      new Set([0, 1, 2]),
    );
    expect([...r.values()].every((u) => u.columnas === 3)).toBe(true);
  });

  it("una cadena de cruces comparte columnas", () => {
    const r = repartir([
      t("a", "09:00", "10:00"),
      t("b", "09:30", "11:00"),
      t("c", "10:30", "12:00"),
    ]);
    expect([...r.values()].every((u) => u.columnas === 2)).toBe(true);
  });

  it("grupos separados no se afectan", () => {
    const r = repartir([
      t("a", "09:00", "10:00"),
      t("b", "09:30", "10:00"),
      t("c", "14:00", "15:00"),
    ]);
    expect(r.get("c")).toEqual({ columna: 0, columnas: 1 });
  });

  it("no depende del orden de entrada", () => {
    const a = repartir([t("x", "09:30", "10:30"), t("y", "09:00", "10:00")]);
    expect(a.get("y")?.columna).toBe(0);
    expect(a.get("x")?.columna).toBe(1);
  });
});

describe("geometría", () => {
  const escala = { inicio: 9 * 60, fin: 19 * 60, bloque: 60 };

  it("alto proporcional a la duración", () => {
    expect(pxPorMinuto(escala)).toBeCloseTo(35 / 60);
    expect(caja(escala, aMinutos("10:00"), aMinutos("11:00"))).toEqual({
      top: 35,
      alto: 33,
    });
  });

  it("una cita corta tiene alto mínimo", () => {
    expect(caja(escala, aMinutos("10:00"), aMinutos("10:10")).alto).toBe(18);
  });

  it("recorta lo que sale de la escala", () => {
    expect(caja(escala, aMinutos("08:00"), aMinutos("10:00")).top).toBe(0);
  });

  it("escala visible redondea al bloque y tiene un valor por defecto", () => {
    expect(
      escalaVisible(
        [{ inicio: aMinutos("09:15"), fin: aMinutos("18:40") }],
        60,
      ),
    ).toEqual({ inicio: 540, fin: 1140, bloque: 60 });
    expect(escalaVisible([], 15)).toEqual({
      inicio: 420,
      fin: 1200,
      bloque: 15,
    });
  });

  it("minuto bajo el puntero se ajusta a la rejilla", () => {
    expect(minutoEn(escala, 40)).toBe(600);
    expect(minutoEn({ ...escala, bloque: 15 }, 40)).toBe(540 + 15);
  });

  it("filas de la columna de horas", () => {
    expect(filas(escala)).toHaveLength(10);
  });
});

describe("fechas", () => {
  it("la semana va de lunes a domingo", () => {
    const r = rangoDeVista("semana", "2026-10-31");
    expect(r.desde).toBe("2026-10-26");
    expect(r.hasta).toBe("2026-11-01");
    expect(r.dias).toHaveLength(7);
  });

  it("el mes se completa con semanas enteras", () => {
    const r = rangoDeVista("mes", "2026-10-15");
    expect(r.desde).toBe("2026-09-28");
    expect(r.hasta).toBe("2026-11-01");
  });

  it("mover el ancla según la vista", () => {
    expect(moverAncla("semana", "2026-10-31", 1)).toBe("2026-11-07");
    expect(moverAncla("dia", "2026-10-31", -1)).toBe("2026-10-30");
    expect(moverAncla("mes", "2026-01-31", 1)).toBe("2026-02-28");
  });

  it("títulos en español", () => {
    expect(tituloRango("semana", "2026-10-31")).toBe("Lun 26/10 – Dom 01/11");
    expect(tituloRango("mes", "2026-10-31")).toBe("Octubre 2026");
  });

  it("ahora en Bogotá aunque el navegador esté en otra zona", () => {
    const instante = new Date("2026-11-01T03:30:00Z"); // 31 oct 22:30 en Bogotá
    expect(ahoraEnZona("America/Bogota", instante)).toEqual({
      fecha: "2026-10-31",
      minutos: 22 * 60 + 30,
    });
  });

  it("3 días empiezan en el ancla y se mueven de a 3", () => {
    const r = rangoDeVista("3dias", "2026-10-31");
    expect(r.dias).toEqual(["2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(moverAncla("3dias", "2026-10-31", 1)).toBe("2026-11-03");
    expect(moverAncla("3dias", "2026-10-31", -1)).toBe("2026-10-28");
    expect(tituloRango("3dias", "2026-10-31")).toBe("Sáb 31/10 – Lun 02/11");
  });

  it("títulos cortos de la cabecera del celular", () => {
    expect(tituloCorto("dia", "2026-11-05")).toBe("jue 5 nov");
    expect(tituloCorto("3dias", "2026-11-05")).toBe("5 – 7 nov");
    expect(tituloCorto("semana", "2026-10-31")).toBe("26 oct – 1 nov");
    expect(tituloCorto("lista", "2026-11-05")).toBe("2 – 8 nov");
    expect(tituloCorto("semana", "2026-12-30")).toBe(
      "28 dic 2026 – 3 ene 2027",
    );
    expect(tituloCorto("mes", "2026-11-05")).toBe("Noviembre 2026");
    expect(tituloRango("dia", "2026-10-31")).toBe("Sábado 31 de octubre");
  });

  it("horas y días", () => {
    expect(aHora(aMinutos("09:05:00"))).toBe("09:05");
    expect(diaSemana("2026-11-01")).toBe(7);
  });
});
