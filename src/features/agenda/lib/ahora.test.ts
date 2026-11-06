import { describe, expect, it } from "vitest";
import type {
  BloqueoAgenda,
  CitaAgenda,
  ClaseAgenda,
  ProfesionalAgenda,
} from "../types";
import { clasificarAhora, horaReservaRapida } from "./ahora";
import { aMinutos } from "./fechas";

// 2026-11-05 es jueves (día 4).
const FECHA = "2026-11-05";

function pro(
  id: string,
  dia: Partial<{
    activo: boolean;
    inicio: string;
    fin: string;
    descanso: [string, string];
  }> = {},
): ProfesionalAgenda {
  const { activo = true, inicio = "09:00", fin = "18:00", descanso } = dia;
  return {
    id,
    nombre: id,
    color: "#000",
    fotoUrl: null,
    localId: "l",
    activo: true,
    horario: [
      {
        dia: 4,
        activo,
        inicio,
        fin,
        descanso: Boolean(descanso),
        descansoInicio: descanso?.[0] ?? "",
        descansoFin: descanso?.[1] ?? "",
      },
    ],
  };
}

function cita(
  profesionalId: string,
  desde: string,
  hasta: string,
  extra: Partial<CitaAgenda> = {},
): CitaAgenda {
  return {
    id: `${profesionalId}-${desde}`,
    profesionalId,
    servicioId: "s",
    clienteId: null,
    clienteNombre: `Cliente ${desde}`,
    clienteTelefono: null,
    clienteCorreo: null,
    servicioNombre: "Corte",
    fecha: FECHA,
    horaInicio: desde,
    horaFin: hasta,
    inicio: aMinutos(desde),
    fin: aMinutos(hasta),
    duracionMin: aMinutos(hasta) - aMinutos(desde),
    estado: "reservado",
    origen: "agenda",
    precio: 0,
    notaCliente: null,
    notaInterna: null,
    serieId: null,
    profesionalFijo: false,
    avisoCorreo: false,
    avisoWhatsapp: false,
    clienteDesde: null,
    motivoCancelacion: null,
    ventaId: null,
    pagada: false,
    ...extra,
  } as CitaAgenda;
}

const a = (hora: string) => aMinutos(hora);

const bloqueo = (
  profesionalId: string,
  desde: string,
  hasta: string,
): BloqueoAgenda => ({
  id: `${profesionalId}-${desde}`,
  profesionalId,
  motivo: "Médico",
  inicio: `${FECHA}T${desde}`,
  fin: `${FECHA}T${hasta}`,
  serieId: null,
});
const clasificar = (
  profesionales: ProfesionalAgenda[],
  hora: string,
  datos: {
    citas?: CitaAgenda[];
    clases?: ClaseAgenda[];
    bloqueos?: BloqueoAgenda[];
  } = {},
) =>
  clasificarAhora({
    profesionales,
    citas: datos.citas ?? [],
    clases: datos.clases ?? [],
    bloqueos: datos.bloqueos ?? [],
    fecha: FECHA,
    minutos: a(hora),
  });

describe("vista Ahora", () => {
  it("atendiendo: cuánto le queda, terminando y la siguiente", () => {
    const r = clasificar([pro("ana")], "10:52", {
      citas: [cita("ana", "10:00", "11:00"), cita("ana", "11:30", "12:00")],
    });
    expect(r.atendiendo).toHaveLength(1);
    const [x] = r.atendiendo;
    expect(x.quedan).toBe(8);
    expect(x.terminando).toBe(true);
    expect(x.actual.quien).toBe("Cliente 10:00");
    expect(x.siguiente?.inicio).toBe(a("11:30"));
  });

  it("canceladas y no asistió no ocupan", () => {
    const r = clasificar([pro("ana")], "10:15", {
      citas: [
        cita("ana", "10:00", "11:00", { estado: "cancelado" }),
        cita("ana", "10:00", "10:30", { estado: "no_asistio" }),
      ],
    });
    expect(r.atendiendo).toHaveLength(0);
    expect(r.libres).toHaveLength(1);
  });

  it("libre hasta la próxima cita o el resto del día", () => {
    const r = clasificar([pro("ana"), pro("beto")], "10:00", {
      citas: [cita("ana", "15:00", "16:00")],
    });
    const hasta = Object.fromEntries(
      r.libres.map((l) => [l.profesional.id, l.hasta]),
    );
    expect(hasta).toEqual({ ana: a("15:00"), beto: null });
    // El que está libre más tiempo va primero.
    expect(r.libres[0].profesional.id).toBe("beto");
  });

  it("antes del descanso, libre hasta que empieza el descanso", () => {
    const r = clasificar(
      [pro("ana", { descanso: ["13:00", "14:00"] })],
      "12:00",
    );
    expect(r.libres[0].hasta).toBe(a("13:00"));
  });

  it("no disponibles: día libre, antes de empezar, en descanso, terminó y bloqueo", () => {
    const profesionales = [
      pro("libre", { activo: false }),
      pro("temprano", { inicio: "14:00" }),
      pro("almuerza", { descanso: ["12:00", "13:00"] }),
      pro("salio", { fin: "12:00" }),
      pro("bloqueado"),
    ];
    const r = clasificar(profesionales, "12:30", {
      bloqueos: [
        {
          id: "b",
          profesionalId: "bloqueado",
          motivo: "Médico",
          inicio: `${FECHA}T12:00`,
          fin: `${FECHA}T13:30`,
          serieId: null,
        },
      ],
    });
    const motivos = Object.fromEntries(
      r.noDisponibles.map((n) => [n.profesional.id, [n.motivo, n.vuelve]]),
    );
    expect(motivos).toEqual({
      libre: ["dia_libre", null],
      temprano: ["antes", a("14:00")],
      almuerza: ["descanso", a("13:00")],
      salio: ["termino", null],
      bloqueado: ["bloqueo", a("13:30")],
    });
    expect(r.libres).toHaveLength(0);
  });

  it("si atiende fuera de horario, cuenta como atendiendo", () => {
    const r = clasificar([pro("ana", { fin: "18:00" })], "19:10", {
      citas: [cita("ana", "19:00", "20:00")],
    });
    expect(r.atendiendo[0]?.quedan).toBe(50);
  });

  it("una clase también ocupa", () => {
    const clase = {
      id: "k",
      servicioId: "s",
      profesionalId: "ana",
      servicioNombre: "Yoga",
      fecha: FECHA,
      horaInicio: "10:00",
      horaFin: "11:00",
      inicio: a("10:00"),
      fin: a("11:00"),
      cupo: 8,
      precio: 0,
      nota: null,
      cancelada: false,
      inscritos: 5,
    } as ClaseAgenda;
    const r = clasificar([pro("ana")], "10:30", { clases: [clase] });
    expect(r.atendiendo[0]?.actual).toMatchObject({
      tipo: "clase",
      quien: "Yoga",
      servicio: "5/8 inscritos",
    });
  });

  it("con dos citas a la vez manda la que termina más tarde", () => {
    const r = clasificar([pro("ana")], "10:20", {
      citas: [
        cita("ana", "10:00", "11:00"),
        cita("ana", "10:15", "10:30"),
        cita("ana", "11:00", "11:30"),
      ],
    });
    const [x] = r.atendiendo;
    expect(x.actual.quien).toBe("Cliente 10:00");
    expect(x.quedan).toBe(40);
    expect(x.ademas).toBe(1);
    expect(x.siguiente?.inicio).toBe(a("11:00"));
  });

  it("tras un bloqueo vuelve cuando de verdad puede atender", () => {
    const r = clasificar(
      [
        pro("descansa", { descanso: ["13:00", "14:00"] }),
        pro("encadenado"),
        pro("hasta_cierre"),
      ],
      "12:30",
      {
        bloqueos: [
          bloqueo("descansa", "12:00", "13:00"),
          bloqueo("encadenado", "12:00", "13:00"),
          bloqueo("encadenado", "13:00", "15:00"),
          bloqueo("hasta_cierre", "12:00", "20:00"),
        ],
      },
    );
    const vuelve = Object.fromEntries(
      r.noDisponibles.map((n) => [n.profesional.id, n.vuelve]),
    );
    expect(vuelve).toEqual({
      descansa: a("14:00"),
      encadenado: a("15:00"),
      hasta_cierre: null,
    });
  });

  it("en descanso con un bloqueo al volver, vuelve cuando termina el bloqueo", () => {
    const r = clasificar(
      [pro("ana", { descanso: ["12:00", "13:00"] })],
      "12:30",
      { bloqueos: [bloqueo("ana", "13:00", "13:45")] },
    );
    expect(r.noDisponibles[0]).toMatchObject({
      motivo: "descanso",
      vuelve: a("13:45"),
    });
  });

  it("fuera de horario muestra su próxima cita aunque caiga fuera de horario", () => {
    const r = clasificar([pro("ana", { fin: "18:00" })], "18:30", {
      citas: [cita("ana", "19:00", "20:00")],
    });
    expect(r.noDisponibles[0]).toMatchObject({
      motivo: "termino",
      proxima: a("19:00"),
    });
  });
});

describe("hora de la reserva rápida", () => {
  it("la próxima de 15 en 15 si sigue libre", () => {
    expect(horaReservaRapida(a("10:02"), null)).toBe(a("10:15"));
    expect(horaReservaRapida(a("10:30"), a("11:00"))).toBe(a("10:30"));
  });

  it("si a esa hora ya no está libre, de 5 en 5 o este minuto", () => {
    expect(horaReservaRapida(a("10:02"), a("10:15"))).toBe(a("10:05"));
    expect(horaReservaRapida(a("10:02"), a("10:05"))).toBe(a("10:02"));
  });
});
