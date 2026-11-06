import { describe, expect, it } from "vitest";
import type { DiaHorario } from "@/features/administracion/schemas";
import { aMinutos } from "@/features/agenda/lib/fechas";
import {
  cuandoEs,
  franjaLibre,
  mesesDe,
  metaDelMes,
  diasAbiertos,
  retencion,
  ticketPromedio,
  type Ocupado,
} from "./tablero";

// 2026-11-06 es viernes (día 5).
const FECHA = "2026-11-06";
const a = aMinutos;

function dia(
  n: number,
  inicio = "09:00",
  fin = "19:00",
  descanso?: [string, string],
): DiaHorario {
  return {
    dia: n,
    activo: true,
    inicio,
    fin,
    descanso: Boolean(descanso),
    descansoInicio: descanso?.[0] ?? "",
    descansoFin: descanso?.[1] ?? "",
  };
}

const semana = (f: (n: number) => DiaHorario) => [1, 2, 3, 4, 5, 6, 7].map(f);

const ocupado = (id: string, desde: string, hasta: string): Ocupado => ({
  profesionalId: id,
  inicio: a(desde),
  fin: a(hasta),
});

describe("franja libre", () => {
  it("la ventana más larga de todos, sin pasar del cierre del local", () => {
    const r = franjaLibre({
      fecha: FECHA,
      local: [dia(5, "09:00", "18:00")],
      // Ana trabaja hasta las 22:00, pero el local cierra a las 18:00.
      profesionales: [
        { id: "ana", horario: [dia(5, "14:00", "22:00")] },
        { id: "beto", horario: [dia(5, "09:00", "18:00")] },
      ],
      ocupado: [ocupado("beto", "09:00", "15:00")],
    });
    expect(r).toMatchObject({
      inicio: a("14:00"),
      fin: a("18:00"),
      profesionales: 2,
    });
    // Ana 14–18 (4 h) + Beto 15–18 (3 h).
    expect(r?.minutosDelDia).toBe(7 * 60);
  });

  it("une los huecos de distintos profesionales que se tocan", () => {
    const r = franjaLibre({
      fecha: FECHA,
      local: [dia(5)],
      profesionales: [
        { id: "ana", horario: [dia(5)] },
        { id: "beto", horario: [dia(5)] },
      ],
      ocupado: [
        ocupado("ana", "09:00", "12:00"),
        ocupado("ana", "14:00", "19:00"),
        ocupado("beto", "09:00", "14:00"),
        ocupado("beto", "16:00", "19:00"),
      ],
    });
    expect(r).toMatchObject({ inicio: a("12:00"), fin: a("16:00") });
  });

  it("el descanso del local parte la franja y los huecos chicos no cuentan", () => {
    const r = franjaLibre({
      fecha: FECHA,
      local: [dia(5, "09:00", "19:00", ["13:00", "14:00"])],
      profesionales: [{ id: "ana", horario: [dia(5)] }],
      ocupado: [
        ocupado("ana", "09:00", "12:40"),
        ocupado("ana", "14:00", "17:00"),
      ],
    });
    // 12:40–13:00 son 20 min (no cuentan); queda 17:00–19:00.
    expect(r).toMatchObject({
      inicio: a("17:00"),
      fin: a("19:00"),
      minutosDelDia: 120,
    });
  });

  it("null si el local no abre o todo está ocupado", () => {
    expect(
      franjaLibre({
        fecha: FECHA,
        local: [{ ...dia(5), activo: false }],
        profesionales: [{ id: "ana", horario: [dia(5)] }],
        ocupado: [],
      }),
    ).toBeNull();
    expect(
      franjaLibre({
        fecha: FECHA,
        local: [dia(5)],
        profesionales: [{ id: "ana", horario: [dia(5)] }],
        ocupado: [ocupado("ana", "08:00", "20:00")],
      }),
    ).toBeNull();
  });
});

describe("días abiertos", () => {
  it("los de la semana que sigue, sin los que el local cierra", () => {
    const deLunesASabado = semana((n) =>
      n === 7 ? { ...dia(7), activo: false } : dia(n),
    );
    expect(diasAbiertos("2026-11-05", deLunesASabado)).toEqual([
      "2026-11-06",
      "2026-11-07",
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
    ]);
    expect(
      diasAbiertos(
        "2026-11-07",
        semana((n) => ({ ...dia(n), activo: false })),
      ),
    ).toEqual([]);
  });

  it("dice mañana o el día", () => {
    expect(cuandoEs("2026-11-05", "2026-11-06")).toBe("mañana");
    expect(cuandoEs("2026-11-07", "2026-11-09")).toBe("el lunes");
  });
});

describe("meta e indicadores", () => {
  it("meta del mes contra el mes anterior", () => {
    expect(metaDelMes(12, 30)).toEqual({
      actual: 12,
      objetivo: 30,
      porcentaje: 40,
      superada: false,
    });
    expect(metaDelMes(45, 30)).toMatchObject({
      porcentaje: 100,
      superada: true,
    });
    expect(metaDelMes(5, 0)).toMatchObject({ objetivo: null, porcentaje: 0 });
  });

  it("retención y ticket promedio", () => {
    // a y c volvieron; b vino una vez.
    expect(retencion(["a", "b", "a", "c", "c", "c"])).toBe(67);
    expect(retencion([])).toBeNull();
    expect(ticketPromedio(100_000, 3)).toBe(33_333);
    expect(ticketPromedio(0, 0)).toBeNull();
  });

  it("meses: el actual completo y el anterior, también en enero", () => {
    expect(mesesDe("2026-11-05")).toEqual({
      mes: { desde: "2026-11-01", hasta: "2026-11-30" },
      anterior: { desde: "2026-10-01", hasta: "2026-10-31" },
    });
    expect(mesesDe("2027-01-15").anterior).toEqual({
      desde: "2026-12-01",
      hasta: "2026-12-31",
    });
    expect(mesesDe("2028-03-01").anterior.hasta).toBe("2028-02-29");
  });
});
