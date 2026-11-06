import { describe, expect, it } from "vitest";
import { abiertosDelDia, cerrados, ocupado, partirPorDia } from "./horario";

const dia = {
  dia: 1,
  activo: true,
  inicio: "09:00",
  fin: "19:00",
  descanso: false,
  descansoInicio: "",
  descansoFin: "",
};

describe("horario del día", () => {
  it("día cerrado o sin horas no tiene tramos", () => {
    expect(abiertosDelDia(undefined)).toEqual([]);
    expect(abiertosDelDia({ ...dia, activo: false })).toEqual([]);
    expect(abiertosDelDia({ ...dia, fin: "08:00" })).toEqual([]);
  });

  it("el descanso parte el día", () => {
    expect(
      abiertosDelDia({
        ...dia,
        descanso: true,
        descansoInicio: "13:00",
        descansoFin: "14:00",
      }),
    ).toEqual([
      { inicio: 540, fin: 780 },
      { inicio: 840, fin: 1140 },
    ]);
  });

  it("lo cerrado es el complemento dentro de la escala", () => {
    expect(cerrados([{ inicio: 540, fin: 1140 }], 480, 1200)).toEqual([
      { inicio: 480, fin: 540 },
      { inicio: 1140, fin: 1200 },
    ]);
    expect(cerrados([], 480, 1200)).toEqual([{ inicio: 480, fin: 1200 }]);
    expect(cerrados([{ inicio: 400, fin: 1300 }], 480, 1200)).toEqual([]);
  });
});

describe("tramos por día", () => {
  const dias = ["2026-10-26", "2026-10-27", "2026-10-28"];

  it("un bloqueo de un día queda en su día", () => {
    expect(
      partirPorDia("2026-10-27T14:00:00", "2026-10-27T15:00:00", dias),
    ).toEqual([{ fecha: "2026-10-27", inicio: 840, fin: 900 }]);
  });

  it("un bloqueo de varios días se parte", () => {
    expect(
      partirPorDia("2026-10-26T18:00:00", "2026-10-28T10:00:00", dias),
    ).toEqual([
      { fecha: "2026-10-26", inicio: 1080, fin: 1440 },
      { fecha: "2026-10-27", inicio: 0, fin: 1440 },
      { fecha: "2026-10-28", inicio: 0, fin: 600 },
    ]);
  });

  it("lo que cae fuera de los días se ignora", () => {
    expect(
      partirPorDia("2026-11-02T09:00:00", "2026-11-02T10:00:00", dias),
    ).toEqual([]);
  });

  it("ocupado detecta cruces pero no toques", () => {
    const t = [{ inicio: 600, fin: 660 }];
    expect(ocupado(t, 630, 690)).toBe(true);
    expect(ocupado(t, 660, 720)).toBe(false);
  });
});
