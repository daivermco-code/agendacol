import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { clienteComo, NEGOCIO_DEMO } from "./ayuda";

// Reglas de las citas en la base (guardar_cita, cambiar_estado_cita, cancelar_cita) contra Supabase local.
type Cliente = SupabaseClient<Database>;
interface Resultado {
  ok: boolean;
  citaIds?: string[];
  choques?: { fecha: string; choques: { tipo: string; resumen: string }[] }[];
  puedeForzar?: boolean;
  revision?: { fecha: string; choques: { tipo: string }[] }[];
  error?: { code: string; message: string };
}

const LOCAL = "a1000000-0000-4000-8000-000000000001";
const CAROLINA = "b0000000-0000-4000-8000-000000000001";
const ANDRES = "b0000000-0000-4000-8000-000000000002";
const VALENTINA = "b0000000-0000-4000-8000-000000000003";

let recepcion: Cliente;
let duena: Cliente;
let servicioId: string;
let clientes: string[];
const creadas: string[] = [];

/** Próximo día de la semana (1 = lunes) a partir de dentro de 8 días, en 'YYYY-MM-DD'. */
function proximo(diaIso: number, semanasExtra = 0): string {
  const d = new Date();
  // Al mediodía: la fecha en UTC (toISOString) es la del día local también de noche, cuando en UTC ya es mañana.
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 8 + semanasExtra * 7);
  while (((d.getDay() + 6) % 7) + 1 !== diaIso) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function guardar(
  c: Cliente,
  p: Record<string, unknown>,
): Promise<Resultado> {
  const { data, error } = await c.rpc("guardar_cita", {
    p: {
      localId: LOCAL,
      servicioId,
      duracionMin: 30,
      precio: 20000,
      estado: "reservado",
      ...p,
    },
  });
  if (error) throw new Error(error.message);
  const r = data as unknown as Resultado;
  if (r.ok && r.citaIds) creadas.push(...r.citaIds);
  return r;
}

async function ajustes(
  cambio: Database["public"]["Tables"]["ajustes"]["Update"],
) {
  await duena.from("ajustes").update(cambio).eq("negocio_id", NEGOCIO_DEMO);
}

/** Crea una cita base libre (07:00 no la usa la semilla: fuera de horario, se fuerza con el ajuste por defecto). */
async function citaBase(
  fecha: string,
  profesionalId: string,
  clienteId: string,
) {
  const r = await guardar(recepcion, {
    fecha,
    horaInicio: "07:00",
    profesionalId,
    clienteId,
    forzar: true,
  });
  expect(r.ok).toBe(true);
  return r.citaIds![0];
}

beforeAll(async () => {
  recepcion = await clienteComo("recepcion@salonceiba.test");
  duena = await clienteComo("duena@salonceiba.test");
  const { data: s } = await recepcion
    .from("servicios")
    .select("id")
    .eq("activo", true)
    .limit(1)
    .single();
  servicioId = s!.id;
  const { data: cl } = await recepcion
    .from("clientes")
    .select("id")
    .order("apellido")
    .limit(3);
  clientes = (cl ?? []).map((c) => c.id);
});

afterAll(async () => {
  if (creadas.length) await duena.from("citas").delete().in("id", creadas);
  await ajustes({
    permitir_sobrepuestas: false,
    permitir_cliente_doble: false,
    bloquear_pasadas: false,
    permitir_fuera_horario: true,
  });
});

describe("choques al guardar", () => {
  it("otra cita del mismo profesional choca y no se puede forzar sin el ajuste", async () => {
    const fecha = proximo(2);
    await citaBase(fecha, VALENTINA, clientes[0]);
    const r = await guardar(recepcion, {
      fecha,
      horaInicio: "07:00",
      profesionalId: VALENTINA,
      clienteId: clientes[1],
    });
    expect(r.ok).toBe(false);
    expect(r.choques?.[0].choques.map((c) => c.tipo)).toContain(
      "cita_profesional",
    );
    expect(r.puedeForzar).toBe(false);
    const forzada = await guardar(recepcion, {
      fecha,
      horaInicio: "07:00",
      profesionalId: VALENTINA,
      clienteId: clientes[1],
      forzar: true,
    });
    expect(forzada.ok).toBe(false);
  });

  it("con reservas sobrepuestas permitidas, forzar guarda", async () => {
    await ajustes({ permitir_sobrepuestas: true });
    const fecha = proximo(3);
    await citaBase(fecha, VALENTINA, clientes[0]);
    const r = await guardar(recepcion, {
      fecha,
      horaInicio: "07:00",
      profesionalId: VALENTINA,
      clienteId: clientes[1],
      forzar: true,
    });
    expect(r.ok).toBe(true);
    await ajustes({ permitir_sobrepuestas: false });
  });

  it("el mismo cliente con otro profesional a la misma hora choca", async () => {
    const fecha = proximo(4);
    await citaBase(fecha, VALENTINA, clientes[2]);
    const r = await guardar(recepcion, {
      fecha,
      horaInicio: "07:00",
      profesionalId: CAROLINA,
      clienteId: clientes[2],
    });
    expect(r.choques?.[0].choques.map((c) => c.tipo)).toContain("cita_cliente");
  });

  it("fuera de horario, descanso y bloqueo", async () => {
    const domingo = await guardar(recepcion, {
      fecha: proximo(7),
      horaInicio: "10:00",
      profesionalId: CAROLINA,
      clienteId: clientes[0],
      soloRevisar: true,
    });
    expect(domingo.revision?.[0].choques.map((c) => c.tipo)).toContain(
      "fuera_horario",
    );
    const descanso = await guardar(recepcion, {
      fecha: proximo(1),
      horaInicio: "13:00",
      profesionalId: CAROLINA,
      clienteId: clientes[0],
      soloRevisar: true,
    });
    expect(descanso.revision?.[0].choques.map((c) => c.tipo)).toContain(
      "descanso",
    );
    const bloqueo = await guardar(recepcion, {
      fecha: proximo(1),
      horaInicio: "14:00",
      profesionalId: ANDRES,
      clienteId: clientes[0],
      soloRevisar: true,
    });
    expect(bloqueo.revision?.[0].choques.map((c) => c.tipo)).toContain(
      "bloqueo",
    );
  });

  it("una serie marca solo la fecha que choca", async () => {
    const fecha = proximo(5);
    const semanaDos = proximo(5, 1);
    await citaBase(semanaDos, VALENTINA, clientes[0]);
    const r = await guardar(recepcion, {
      fecha,
      horaInicio: "07:00",
      profesionalId: VALENTINA,
      clienteId: clientes[1],
      repetir: { cada: "semana", veces: 3 },
      soloRevisar: true,
    });
    const conChoque = r.revision
      ?.filter((x) => x.choques.some((c) => c.tipo === "cita_profesional"))
      .map((x) => x.fecha);
    expect(conChoque).toEqual([semanaDos]);
    const serie = await guardar(recepcion, {
      fecha,
      horaInicio: "07:00",
      profesionalId: VALENTINA,
      clienteId: clientes[1],
      repetir: { cada: "semana", veces: 3 },
      omitir: [semanaDos],
      forzar: true,
    });
    expect(serie.citaIds).toHaveLength(2);
  });

  it("con citas pasadas bloqueadas no deja agendar ayer", async () => {
    await ajustes({ bloquear_pasadas: true });
    const ayer = new Date(Date.now() - 2 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const r = await guardar(recepcion, {
      fecha: ayer,
      horaInicio: "07:00",
      profesionalId: CAROLINA,
      clienteId: clientes[0],
    });
    expect(r.error?.code).toBe("CITA_PASADA");
    await ajustes({ bloquear_pasadas: false });
  });
});

describe("estado, mover y cancelar", () => {
  it("la profesional cambia el estado de sus citas, no el de otras, y no agenda", async () => {
    const carolina = await clienteComo("carolina@salonceiba.test");
    const propia = await citaBase(proximo(6), CAROLINA, clientes[0]);
    const ajena = await citaBase(proximo(6), VALENTINA, clientes[1]);
    const a = await carolina.rpc("cambiar_estado_cita", {
      p_cita: propia,
      p_estado: "confirmado",
    });
    expect((a.data as unknown as Resultado).ok).toBe(true);
    const b = await carolina.rpc("cambiar_estado_cita", {
      p_cita: ajena,
      p_estado: "confirmado",
    });
    expect((b.data as unknown as Resultado).ok).toBe(false);
    const c = await guardar(carolina, {
      fecha: proximo(6),
      horaInicio: "08:00",
      profesionalId: CAROLINA,
      clienteId: clientes[0],
    });
    expect(c.error?.code).toBe("SIN_PERMISO");
  });

  it("mover a un hueco ocupado revisa choques igual que crear", async () => {
    const fecha = proximo(2, 2);
    await citaBase(fecha, VALENTINA, clientes[0]);
    const otra = await guardar(recepcion, {
      fecha,
      horaInicio: "08:00",
      profesionalId: VALENTINA,
      clienteId: clientes[1],
      forzar: true,
    });
    const movida = await guardar(recepcion, {
      id: otra.citaIds![0],
      fecha,
      horaInicio: "07:00",
      profesionalId: VALENTINA,
      clienteId: clientes[1],
    });
    expect(movida.choques?.[0].choques.map((c) => c.tipo)).toContain(
      "cita_profesional",
    );
  });

  it("cancelar esta y las siguientes deja las anteriores", async () => {
    const serie = await guardar(recepcion, {
      fecha: proximo(3, 3),
      horaInicio: "07:00",
      profesionalId: ANDRES,
      clienteId: clientes[2],
      repetir: { cada: "semana", veces: 3 },
      forzar: true,
    });
    const [primera, segunda] = serie.citaIds!;
    const { data } = await recepcion.rpc("cancelar_cita", {
      p_cita: segunda,
      p_alcance: "esta_y_siguientes",
      p_motivo: "Viaje",
    });
    expect((data as unknown as Resultado).citaIds).toHaveLength(2);
    const { data: filas } = await recepcion
      .from("citas")
      .select("id, estado")
      .in("id", serie.citaIds!);
    expect(filas?.find((f) => f.id === primera)?.estado).toBe("reservado");
    const { count } = await recepcion
      .from("avisos_demo")
      .select("id", { count: "exact", head: true })
      .eq("cita_id", segunda)
      .eq("tipo", "cancelacion");
    expect(count).toBeGreaterThan(0);
  });
});
