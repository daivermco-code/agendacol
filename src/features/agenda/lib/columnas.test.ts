import { describe, expect, it } from "vitest";
import type { DiaHorario } from "@/features/administracion/schemas";
import type {
  BloqueoAgenda,
  CitaAgenda,
  LocalAgenda,
  ProfesionalAgenda,
} from "../types";
import { columnasDia, columnasSemana } from "./columnas";
import { ESTADOS, ESTADOS_ACTIVOS, ORDEN_ESTADOS } from "./estados";

const dia = (n: number, activo = true): DiaHorario => ({
  dia: n,
  activo,
  inicio: "09:00",
  fin: "18:00",
  descanso: false,
  descansoInicio: "",
  descansoFin: "",
});
const semanaLaboral = [1, 2, 3, 4, 5, 6, 7].map((n) => dia(n, n < 7));

const local: LocalAgenda = {
  id: "l",
  nombre: "Sede",
  zona: "America/Bogota",
  horario: semanaLaboral,
};
const prof = (
  id: string,
  nombre: string,
  horario = semanaLaboral,
): ProfesionalAgenda => ({
  id,
  nombre,
  color: "#000",
  fotoUrl: null,
  localId: "l",
  activo: true,
  horario,
});
const ana = prof("a", "Ana Ruiz");
const beto = prof(
  "b",
  "Beto Paz",
  [1, 2, 3, 4, 5, 6, 7].map((n) => dia(n, n === 1)),
);

const cita = (
  id: string,
  profesionalId: string,
  fecha: string,
  inicio: number,
): CitaAgenda => ({
  id,
  profesionalId,
  servicioId: "s",
  clienteId: null,
  clienteNombre: "Cliente",
  clienteTelefono: null,
  clienteCorreo: null,
  servicioNombre: "Corte",
  fecha,
  horaInicio: "",
  horaFin: "",
  inicio,
  fin: inicio + 60,
  duracionMin: 60,
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
  pagoParcial: false,
  bonoId: null,
  bonoNombre: null,
  recursoId: null,
});

const citas = [
  cita("1", "a", "2026-10-26", 600),
  cita("2", "b", "2026-10-26", 660),
  cita("3", "a", "2026-10-27", 600),
];
const bloqueos: BloqueoAgenda[] = [
  {
    id: "x",
    profesionalId: "b",
    motivo: "Almuerzo",
    inicio: "2026-10-26T13:00:00",
    fin: "2026-10-26T14:00:00",
    serieId: null,
  },
];
const escala = { inicio: 480, fin: 1140, bloque: 60 };
const dias = [
  "2026-10-26",
  "2026-10-27",
  "2026-10-28",
  "2026-10-29",
  "2026-10-30",
  "2026-10-31",
  "2026-11-01",
];

describe("columnas de la semana", () => {
  it("con todos: una columna por día, horario del local y bloqueos con nombre", () => {
    const cols = columnasSemana({
      dias,
      local,
      profesional: null,
      profesionales: [ana, beto],
      citas,
      bloqueos,
      escala,
    });
    expect(cols).toHaveLength(7);
    expect(cols[0].citas.map((c) => c.id)).toEqual(["1", "2"]);
    expect(cols[0].bloqueos[0].motivo).toBe("Almuerzo · Beto");
    expect(cols[0].cerrados).toEqual([
      { inicio: 480, fin: 540 },
      { inicio: 1080, fin: 1140 },
    ]);
    expect(cols[6].cerrados).toEqual([{ inicio: 480, fin: 1140 }]);
  });

  it("con un profesional: solo sus citas, sus bloqueos y su horario", () => {
    const cols = columnasSemana({
      dias,
      local,
      profesional: beto,
      profesionales: [ana, beto],
      citas,
      bloqueos,
      escala,
    });
    expect(cols[0].citas.map((c) => c.id)).toEqual(["2"]);
    expect(cols[0].bloqueos[0].motivo).toBe("Almuerzo");
    expect(cols[1].cerrados).toEqual([{ inicio: 480, fin: 1140 }]);
  });
});

describe("columnas del día", () => {
  it("una columna por profesional con su horario", () => {
    const cols = columnasDia({
      fecha: "2026-10-27",
      profesionales: [ana, beto],
      citas,
      bloqueos,
      escala,
    });
    expect(cols.map((c) => c.clave)).toEqual(["a", "b"]);
    expect(cols[0].citas.map((c) => c.id)).toEqual(["3"]);
    expect(cols[1].citas).toEqual([]);
    expect(cols[1].cerrados).toEqual([{ inicio: 480, fin: 1140 }]);
  });
});

describe("estados", () => {
  it("cada estado tiene nombre y colores; las activas no incluyen canceladas", () => {
    for (const e of ORDEN_ESTADOS)
      expect(ESTADOS[e].fondo).toMatch(/^var\(--estado-[a-z-]+-fondo\)$/);
    expect(ESTADOS_ACTIVOS).not.toContain("cancelado");
    expect(ESTADOS_ACTIVOS).toHaveLength(6);
  });
});
