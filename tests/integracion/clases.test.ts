import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  clienteAnonimo,
  clienteComo,
  clienteServicio,
  NEGOCIO_DEMO,
} from "./ayuda";

// Clases con cupo (0010): crear sesiones, choques con la agenda, inscribir hasta llenar, asistencia y planes. Usa
// un lunes de dentro de 10 semanas (lejos de la semilla) y al final borra sus clases, el plan y el bono de prueba.
type Cliente = SupabaseClient<Database>;
interface Resultado {
  ok: boolean;
  ids?: string[];
  revision?: { fecha: string; choques: { tipo: string; resumen: string }[] }[];
  error?: { code: string; message: string; field?: string };
}

const LOCAL = "a1000000-0000-4000-8000-000000000001";
const VALENTINA = "b0000000-0000-4000-8000-000000000003";

let servicio: Cliente;
let recepcion: Cliente;
let valentina: Cliente;
let claseServicio: { id: string; precio: number };
let clientes: string[];
let planId: string;
let bonoId: string;
const clases: string[] = [];

/** El lunes que cae 10 semanas (o un poco más) adelante. */
function lunes(semanasExtra = 0): string {
  const d = new Date();
  // Al mediodía: la fecha en UTC (toISOString) es la del día local también de noche, cuando en UTC ya es mañana.
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 70 + semanasExtra * 7);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function rpc(
  c: Cliente,
  fn:
    "guardar_clase" | "inscribir_clase" | "estado_inscrito" | "cancelar_clase",
  args: Record<string, unknown>,
): Promise<Resultado> {
  // El nombre de la función varía, así que los argumentos no se pueden tipar uno a uno.
  const { data, error } = await (
    c.rpc as unknown as (
      f: string,
      a: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  )(fn, args);
  if (error) throw new Error(error.message);
  const r = data as Resultado;
  if (fn === "guardar_clase" && r.ok && r.ids) {
    for (const id of r.ids) if (!clases.includes(id)) clases.push(id);
  }
  return r;
}

const guardar = (c: Cliente, p: Record<string, unknown>) =>
  rpc(c, "guardar_clase", {
    p: {
      localId: LOCAL,
      servicioId: claseServicio.id,
      profesionalId: VALENTINA,
      fecha: lunes(),
      horaInicio: "09:00",
      veces: 1,
      ...p,
    },
  });
const inscribir = (
  cliente: string,
  bono: string | null = null,
  clase = clases[0],
) =>
  rpc(recepcion, "inscribir_clase", {
    p_clase: clase,
    p_cliente: cliente,
    p_bono: bono,
  });

async function inscrito(cliente: string, clase = clases[0]) {
  const { data } = await servicio
    .from("clase_inscritos")
    .select("id, estado")
    .eq("clase_id", clase)
    .eq("cliente_id", cliente)
    .single();
  return data!;
}

async function usadas(): Promise<number> {
  const { data } = await recepcion.rpc("listar_bonos", {
    p_cliente: clientes[0],
  });
  return data!.find((b) => b.id === bonoId)!.usadas;
}

beforeAll(async () => {
  servicio = clienteServicio();
  recepcion = await clienteComo("recepcion@salonceiba.test");
  valentina = await clienteComo("valentina@salonceiba.test");
  const { data: s } = await recepcion
    .from("servicios")
    .select("id, precio")
    .eq("tipo", "clase")
    .limit(1)
    .single();
  claseServicio = s!;
  const { data: cl } = await recepcion
    .from("clientes")
    .select("id")
    .order("apellido")
    .limit(3);
  clientes = cl!.map((c) => c.id);
  const { data: p, error } = await servicio
    .from("planes")
    .insert({
      negocio_id: NEGOCIO_DEMO,
      nombre: "Plan clases E2E",
      precio: 50000,
      vigencia_dias: 180,
      sesiones: 1,
      servicios: [claseServicio.id],
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  planId = p!.id;
  const { data: b } = await servicio
    .from("bonos")
    .insert({
      negocio_id: NEGOCIO_DEMO,
      cliente_id: clientes[0],
      tipo: "plan",
      plan_id: planId,
      nombre: "Plan clases E2E",
      servicios: [claseServicio.id],
      cupo: 1,
      inicio: new Date().toISOString().slice(0, 10),
      vence: lunes(4),
    })
    .select("id")
    .single();
  bonoId = b!.id;
});

afterAll(async () => {
  if (clases.length) await servicio.from("clases").delete().in("id", clases);
  if (bonoId) await servicio.from("bonos").delete().eq("id", bonoId);
  if (planId) await servicio.from("planes").delete().eq("id", planId);
});

describe("clases sin sesión", () => {
  it("el público no ve clases ni inscritos ni usa sus funciones", async () => {
    const anon = clienteAnonimo();
    for (const tabla of ["clases", "clase_inscritos"] as const) {
      const { data } = await anon.from(tabla).select("id").limit(1);
      expect(data ?? []).toEqual([]);
    }
    const { error } = await anon.rpc("guardar_clase", {
      p: { fecha: lunes() },
    });
    expect(error).not.toBeNull();
    const lista = await anon.rpc("agenda_clases", {
      p_local: LOCAL,
      p_desde: lunes(),
      p_hasta: lunes(1),
    });
    expect(lista.data ?? []).toEqual([]);
  });
});

describe("crear clases", () => {
  it("se crea cada semana y ocupa al profesional", async () => {
    const r = await guardar(recepcion, { veces: 2 });
    expect(r.ok).toBe(true);
    expect(r.ids).toHaveLength(2);
    const { data } = await recepcion.rpc("agenda_clases", {
      p_local: LOCAL,
      p_desde: lunes(),
      p_hasta: lunes(1),
    });
    expect(data!.filter((k) => clases.includes(k.id))).toHaveLength(2);
    expect(data![0]).toMatchObject({
      hora_inicio: "09:00:00",
      precio: claseServicio.precio,
      inscritos: 0,
    });
  });

  it("otra clase o una cita encima chocan", async () => {
    const otra = await guardar(recepcion, { horaInicio: "10:00" });
    expect(otra.error).toMatchObject({ code: "CHOQUE", field: "horaInicio" });
    expect(otra.error!.message).toMatch(
      /^\d\d\/\d\d: Valentina Ospina da la clase "/,
    );
    const { data } = await recepcion.rpc("guardar_cita", {
      p: {
        localId: LOCAL,
        servicioId: (
          await recepcion
            .from("servicios")
            .select("id")
            .eq("tipo", "servicio")
            .limit(1)
            .single()
        ).data!.id,
        duracionMin: 30,
        precio: 20000,
        estado: "reservado",
        fecha: lunes(1),
        horaInicio: "10:30",
        profesionalId: VALENTINA,
        clienteId: clientes[1],
        soloRevisar: true,
      },
    });
    const revision = (data as unknown as Resultado).revision!;
    expect(revision[0].choques.map((c) => c.resumen).join(" ")).toMatch(
      /da la clase/,
    );
  });

  it("no se crean en días pasados ni las crea un profesional", async () => {
    expect(
      (await guardar(recepcion, { fecha: "2020-01-06" })).error?.code,
    ).toBe("PASADA");
    expect((await guardar(valentina, {})).error?.code).toBe("SIN_PERMISO");
  });
});

describe("inscribir", () => {
  it("llena el cupo, no repite cliente y libera el lugar al quitar", async () => {
    expect((await guardar(recepcion, { id: clases[0], cupo: 2 })).ok).toBe(
      true,
    );
    expect((await inscribir(clientes[1])).ok).toBe(true);
    expect((await inscribir(clientes[1])).error?.code).toBe("YA_INSCRITO");
    expect((await inscribir(clientes[2])).ok).toBe(true);
    expect((await inscribir(clientes[0])).error).toMatchObject({
      code: "CUPO_LLENO",
      message: "La clase está llena (2 de 2)",
    });
    const bajar = await guardar(recepcion, { id: clases[0], cupo: 1 });
    expect(bajar.error?.message).toBe(
      "El cupo no puede quedar por debajo de los inscritos",
    );
    const quitar = await rpc(recepcion, "estado_inscrito", {
      p_inscrito: (await inscrito(clientes[2])).id,
      p_estado: "cancelado",
    });
    expect(quitar.ok).toBe(true);
    expect((await inscribir(clientes[0])).ok).toBe(true);
    const volver = await rpc(recepcion, "estado_inscrito", {
      p_inscrito: (await inscrito(clientes[2])).id,
      p_estado: "inscrito",
    });
    expect(volver.error?.code).toBe("CUPO_LLENO");
  });

  it("el profesional marca la asistencia de su clase pero no inscribe ni quita", async () => {
    const id = (await inscrito(clientes[1])).id;
    const asiste = await rpc(valentina, "estado_inscrito", {
      p_inscrito: id,
      p_estado: "asiste",
    });
    expect(asiste.ok).toBe(true);
    expect((await inscrito(clientes[1])).estado).toBe("asiste");
    const quitar = await rpc(valentina, "estado_inscrito", {
      p_inscrito: id,
      p_estado: "cancelado",
    });
    expect(quitar.error?.code).toBe("SIN_PERMISO");
    const anotar = await rpc(valentina, "inscribir_clase", {
      p_clase: clases[1],
      p_cliente: clientes[1],
    });
    expect(anotar.error?.code).toBe("SIN_PERMISO");
    const carolina = await clienteComo("carolina@salonceiba.test");
    const ajena = await rpc(carolina, "estado_inscrito", {
      p_inscrito: id,
      p_estado: "no_asistio",
    });
    expect(ajena.error?.code).toBe("SIN_PERMISO");
    const { data } = await carolina
      .from("clases")
      .select("id")
      .in("id", clases);
    expect(data).toEqual([]);
  });

  it("un plan paga la clase y la recupera si la clase se cancela", async () => {
    expect(await usadas()).toBe(0);
    expect((await inscribir(clientes[0], bonoId, clases[1])).ok).toBe(true);
    expect(await usadas()).toBe(1);
    const otro = await inscribir(clientes[1], bonoId, clases[1]);
    expect(otro.error).toMatchObject({
      code: "NO_SIRVE",
      message: "Ese plan es de otro cliente",
    });
    const cancelar = await rpc(recepcion, "cancelar_clase", {
      p_clase: clases[1],
      p_motivo: "Prueba",
    });
    expect(cancelar.ok).toBe(true);
    expect((await inscrito(clientes[0], clases[1])).estado).toBe("cancelado");
    expect(await usadas()).toBe(0);
    expect((await inscribir(clientes[2], null, clases[1])).error?.code).toBe(
      "CANCELADA",
    );
  });
});
