import { describe, expect, it } from "vitest";
import { repartir, repartirConTope } from "./reparto";

const t = (id: string, inicio: number, fin: number) => ({ id, inicio, fin });

describe("reparto con tope de carriles", () => {
  it("si caben, es igual que repartir", () => {
    const tramos = [t("a", 600, 660), t("b", 630, 690), t("c", 700, 720)];
    const r = repartirConTope(tramos, 2);
    expect(r.lugares).toEqual(repartir(tramos));
    expect(r.mas).toEqual([]);
  });

  it("con 4 a la vez y tope 2: se ve una y el resto va en +3 más", () => {
    const tramos = [
      t("a", 600, 660),
      t("b", 600, 660),
      t("c", 610, 640),
      t("d", 620, 700),
    ];
    const r = repartirConTope(tramos, 2);
    expect([...r.lugares.keys()]).toEqual(["a"]);
    expect(r.lugares.get("a")).toEqual({ columna: 0, columnas: 2 });
    expect(r.mas).toEqual([
      { columna: 1, columnas: 2, inicio: 600, fin: 700, ids: ["b", "c", "d"] },
    ]);
  });

  it("cada grupo se cuenta aparte", () => {
    const tramos = [
      t("a", 600, 660),
      t("b", 600, 660),
      t("c", 600, 660),
      t("d", 800, 860),
    ];
    const r = repartirConTope(tramos, 3);
    expect(r.mas).toEqual([]);
    expect(r.lugares.get("d")).toEqual({ columna: 0, columnas: 1 });
  });
});

describe("reparto con tope: solo se esconde lo que no cabe", () => {
  it("una cita que solo se cruza con un bloqueo largo se sigue viendo", () => {
    const tramos = [
      t("bloqueo", 480, 1080),
      t("a", 540, 600),
      t("b", 900, 960),
      t("c", 900, 960),
    ];
    const r = repartirConTope(tramos, 2);
    expect(r.lugares.get("a")).toEqual({ columna: 1, columnas: 2 });
    expect(r.mas).toEqual([
      { columna: 1, columnas: 2, inicio: 900, fin: 960, ids: ["b", "c"] },
    ]);
  });

  it("dos cruces lejanos dan dos +N más, cada uno en su tramo", () => {
    const tramos = [
      t("largo", 480, 1080),
      t("a", 540, 600),
      t("b", 540, 600),
      t("c", 900, 960),
      t("d", 930, 990),
    ];
    const r = repartirConTope(tramos, 2);
    expect(r.mas.map((m) => [m.inicio, m.fin, m.ids])).toEqual([
      [540, 600, ["a", "b"]],
      [900, 990, ["c", "d"]],
    ]);
  });
});
