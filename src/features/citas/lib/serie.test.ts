import { describe, expect, it } from "vitest";
import { esquemaBloqueo, esquemaCita } from "../schemas";
import { fechasSerie, tramosBloqueo } from "./serie";

describe("fechas de una serie", () => {
  it("sin repetir es solo la fecha", () => {
    expect(fechasSerie("2026-11-03", null)).toEqual(["2026-11-03"]);
  });

  it("cada semana, cada 2 semanas y cada mes", () => {
    expect(fechasSerie("2026-11-03", { cada: "semana", veces: 3 })).toEqual([
      "2026-11-03",
      "2026-11-10",
      "2026-11-17",
    ]);
    expect(
      fechasSerie("2026-11-03", { cada: "dos_semanas", veces: 2 }),
    ).toEqual(["2026-11-03", "2026-11-17"]);
    expect(fechasSerie("2027-01-31", { cada: "mes", veces: 3 })).toEqual([
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
    ]);
  });

  it("los bloqueos repetidos guardan su largo, aunque crucen la noche", () => {
    expect(
      tramosBloqueo("2026-11-03T22:00:00", "2026-11-04T06:00:00", {
        cada: "semana",
        veces: 2,
      }),
    ).toEqual([
      { inicio: "2026-11-03T22:00:00", fin: "2026-11-04T06:00:00" },
      { inicio: "2026-11-10T22:00:00", fin: "2026-11-11T06:00:00" },
    ]);
  });
});

const citaValida = {
  localId: "a1000000-0000-4000-8000-000000000001",
  clienteId: "c1000000-0000-4000-8000-000000000001",
  profesionalId: "b0000000-0000-4000-8000-000000000001",
  servicioId: "d1000000-0000-4000-8000-000000000001",
  fecha: "2026-11-03",
  horaInicio: "10:30",
  duracionMin: 45,
  precio: 35000,
  estado: "reservado",
  profesionalFijo: false,
  notaCliente: "",
  notaInterna: "",
  avisoCorreo: true,
  avisoWhatsapp: true,
  repetir: null,
  omitir: [],
};

describe("esquemas de cita y bloqueo", () => {
  it("pide cliente, profesional y servicio con mensajes propios", () => {
    const r = esquemaCita.safeParse({ ...citaValida, clienteId: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("Elige un cliente");
    expect(esquemaCita.safeParse(citaValida).success).toBe(true);
  });

  it("no deja pasar de la medianoche ni guardar canceladas", () => {
    const tarde = esquemaCita.safeParse({ ...citaValida, horaInicio: "23:30" });
    expect(tarde.error?.issues[0].message).toBe(
      "La cita no puede pasar de la medianoche",
    );
    expect(
      esquemaCita.safeParse({ ...citaValida, estado: "cancelado" }).success,
    ).toBe(false);
  });

  it("el bloqueo debe terminar después de empezar", () => {
    const r = esquemaBloqueo.safeParse({
      profesionalId: citaValida.profesionalId,
      motivo: "Almuerzo",
      fechaInicio: "2026-11-03",
      horaInicio: "13:00",
      fechaFin: "2026-11-03",
      horaFin: "12:00",
      repetir: null,
    });
    expect(r.error?.issues[0].message).toBe("El fin debe ser después del inicio");
  });
});
