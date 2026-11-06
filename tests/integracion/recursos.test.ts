import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  clienteAnonimo,
  clienteComo,
  clienteServicio,
  NEGOCIO_DEMO,
} from "./ayuda";

// Recursos (0011): la cita toma el primer recurso libre del servicio, el recurso ocupado es un choque y solo se
// fuerza con el ajuste de sobrecarga. Usa un martes de dentro de 11 semanas y al final borra sus citas.
type Cliente = SupabaseClient<Database>;
interface Resultado {
  ok: boolean;
  citaIds?: string[];
  puedeForzar?: boolean;
  revision?: { fecha: string; choques: { tipo: string; resumen: string }[] }[];
  choques?: { fecha: string; choques: { tipo: string; resumen: string }[] }[];
  error?: { code: string; message: string; field?: string };
}

const LOCAL = "a1000000-0000-4000-8000-000000000001";
const CAROLINA = "b0000000-0000-4000-8000-000000000001";
const VALENTINA = "b0000000-0000-4000-8000-000000000003";
const JULIAN = "b0000000-0000-4000-8000-000000000004";

let servicio: Cliente;
let recepcion: Cliente;
let clientes: string[];
const ids: Record<string, string> = {};
const creadas: string[] = [];

function martes(): string {
  const d = new Date();
  // Al mediodía: la fecha en UTC (toISOString) es la del día local también de noche, cuando en UTC ya es mañana.
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 77);
  while (d.getDay() !== 2) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function guardar(p: Record<string, unknown>): Promise<Resultado> {
  const { data, error } = await recepcion.rpc("guardar_cita", {
    p: {
      localId: LOCAL,
      fecha: martes(),
      horaInicio: "12:00",
      duracionMin: 60,
      precio: 50000,
      estado: "reservado",
      ...p,
    },
  });
  if (error) throw new Error(error.message);
  const r = data as unknown as Resultado;
  if (r.ok && r.citaIds) creadas.push(...r.citaIds);
  return r;
}

async function recursoDe(cita: string): Promise<string | null> {
  const { data } = await servicio
    .from("citas")
    .select("recurso_id")
    .eq("id", cita)
    .single();
  return data!.recurso_id;
}

const ajustes = (permitir: boolean) =>
  servicio
    .from("ajustes")
    .update({ permitir_sobrecarga_recursos: permitir })
    .eq("negocio_id", NEGOCIO_DEMO);

beforeAll(async () => {
  servicio = clienteServicio();
  recepcion = await clienteComo("recepcion@salonceiba.test");
  const { data: s } = await recepcion
    .from("servicios")
    .select("id, nombre")
    .in("nombre", ["Masaje relajante", "Lifting de pestañas", "Corte de dama"]);
  for (const x of s!) ids[x.nombre] = x.id;
  const { data: r } = await recepcion.from("recursos").select("id, nombre");
  for (const x of r!) ids[x.nombre] = x.id;
  const { data: cl } = await recepcion
    .from("clientes")
    .select("id")
    .order("apellido")
    .limit(4);
  clientes = cl!.map((c) => c.id);
});

afterAll(async () => {
  if (creadas.length) await servicio.from("citas").delete().in("id", creadas);
  await ajustes(false);
});

describe("recursos sin permiso", () => {
  it("el público no los ve y un profesional no los crea", async () => {
    const { data } = await clienteAnonimo().from("recursos").select("id");
    expect(data ?? []).toEqual([]);
    const carolina = await clienteComo("carolina@salonceiba.test");
    const { error } = await carolina.from("recursos").insert({
      negocio_id: NEGOCIO_DEMO,
      local_id: LOCAL,
      nombre: "Cabina pirata",
    });
    expect(error).not.toBeNull();
  });
});

describe("asignar recursos", () => {
  let masaje: string;
  let lifting: string;

  it("cada cita toma el primer recurso libre del servicio", async () => {
    const a = await guardar({
      clienteId: clientes[0],
      profesionalId: JULIAN,
      servicioId: ids["Masaje relajante"],
    });
    expect(a.ok).toBe(true);
    masaje = a.citaIds![0];
    expect(await recursoDe(masaje)).toBe(ids["Cabina 1"]);
    const b = await guardar({
      clienteId: clientes[1],
      profesionalId: VALENTINA,
      servicioId: ids["Lifting de pestañas"],
    });
    lifting = b.citaIds![0];
    expect(await recursoDe(lifting)).toBe(ids["Cabina 2"]);
    const { data } = await recepcion.rpc("agenda_citas", {
      p_local: LOCAL,
      p_desde: martes(),
      p_hasta: martes(),
    });
    expect(data!.find((c) => c.id === masaje)?.recurso_id).toBe(
      ids["Cabina 1"],
    );
  });

  it("sin recursos libres es un choque que solo pasa con la sobrecarga", async () => {
    const pedido = {
      clienteId: clientes[2],
      profesionalId: CAROLINA,
      servicioId: ids["Masaje relajante"],
    };
    const revision = await guardar({ ...pedido, soloRevisar: true });
    expect(revision.revision![0].choques).toEqual([
      {
        tipo: "recurso",
        resumen:
          "No queda libre ningún recurso para este servicio (Cabina 1, Cabina 2)",
      },
    ]);
    expect(revision.puedeForzar).toBe(false);
    expect((await guardar({ ...pedido, forzar: true })).ok).toBe(false);
    await ajustes(true);
    const forzada = await guardar({ ...pedido, forzar: true });
    expect(forzada.ok).toBe(true);
    expect(await recursoDe(forzada.citaIds![0])).toBeNull();
    await ajustes(false);
  });

  it("un recurso elegido a mano y ocupado choca; uno de otro local no se acepta", async () => {
    const pedido = {
      clienteId: clientes[3],
      profesionalId: CAROLINA,
      servicioId: ids["Corte de dama"],
      horaInicio: "12:30",
      duracionMin: 30,
    };
    const ocupado = await guardar({
      ...pedido,
      recursoId: ids["Cabina 1"],
      soloRevisar: true,
    });
    const recurso = ocupado.revision![0].choques.find(
      (c) => c.tipo === "recurso",
    );
    expect(recurso?.resumen).toMatch(
      /^Cabina 1 está ocupado con .+ \(Masaje relajante\) de 12:00 a 13:00$/,
    );
    const ajeno = await guardar({
      ...pedido,
      recursoId: ids["Mesa de uñas"],
    });
    expect(ajeno.error).toMatchObject({
      code: "VALIDACION",
      field: "recursoId",
    });
    const libre = await guardar({
      ...pedido,
      horaInicio: "15:00",
      recursoId: ids["Lavacabezas"],
    });
    expect(libre.ok).toBe(true);
    expect(await recursoDe(libre.citaIds![0])).toBe(ids["Lavacabezas"]);
  });

  it("al cancelar, el recurso queda libre para otra cita", async () => {
    await recepcion.rpc("cancelar_cita", {
      p_cita: lifting,
      p_motivo: "Prueba",
      p_alcance: "solo_esta",
    });
    const otra = await guardar({
      clienteId: clientes[1],
      profesionalId: VALENTINA,
      servicioId: ids["Lifting de pestañas"],
    });
    expect(otra.ok).toBe(true);
    expect(await recursoDe(otra.citaIds![0])).toBe(ids["Cabina 2"]);
    expect(await recursoDe(masaje)).toBe(ids["Cabina 1"]);
  });
});
