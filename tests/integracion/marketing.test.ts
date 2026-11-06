import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import {
  clienteAnonimo,
  clienteComo,
  clienteServicio,
  NEGOCIO_DEMO,
} from "./ayuda";

// Correo masivo, sellos y plantillas de WhatsApp (0012). Las campañas de prueba llevan "Prueba marketing" en el
// asunto; las citas son de un miércoles de dentro de 13 semanas. Al final se borra todo lo que crearon.
type Cliente = SupabaseClient<Database>;
interface Respuesta {
  ok: boolean;
  destinatarios?: number;
  citaIds?: string[];
  error?: { code: string; message: string };
}

const LOCAL = "a1000000-0000-4000-8000-000000000001";
const VALENTINA = "b0000000-0000-4000-8000-000000000003";
const ASUNTO = "Prueba marketing";

let servicio: Cliente;
let duena: Cliente;
let recepcion: Cliente;
let manicure: string;
const citas: string[] = [];
const campanas: string[] = [];
const audiencias: string[] = [];
const clientesConCanje: string[] = [];

function miercoles(): string {
  const d = new Date();
  // Al mediodía: la fecha en UTC (toISOString) es la del día local también de noche, cuando en UTC ya es mañana.
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 91);
  while (d.getDay() !== 3) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function nuevaCita(clienteId: string, hora: string): Promise<string> {
  const { data, error } = await recepcion.rpc("guardar_cita", {
    p: {
      localId: LOCAL,
      fecha: miercoles(),
      horaInicio: hora,
      duracionMin: 60,
      precio: 25000,
      estado: "reservado",
      clienteId,
      profesionalId: VALENTINA,
      servicioId: manicure,
    },
  });
  if (error) throw new Error(error.message);
  const r = data as unknown as Respuesta;
  if (!r.ok) throw new Error(r.error?.message);
  citas.push(r.citaIds![0]);
  return r.citaIds![0];
}

async function estado(cita: string, e: "asiste" | "reservado") {
  const { data } = await recepcion.rpc("cambiar_estado_cita", {
    p_cita: cita,
    p_estado: e,
  });
  expect((data as unknown as Respuesta).ok).toBe(true);
}

const sellosDe = async (clienteId: string) =>
  (
    await servicio
      .from("sellos")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", clienteId)
  ).count ?? 0;

async function crearCampana(audienciaId: string | null): Promise<string> {
  const { data, error } = await duena
    .from("campanas")
    .insert({
      negocio_id: NEGOCIO_DEMO,
      audiencia_id: audienciaId,
      asunto: ASUNTO,
      cuerpo: "Hola {nombre}, esto es una prueba.",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  campanas.push(data.id);
  return data.id;
}

beforeAll(async () => {
  servicio = clienteServicio();
  duena = await clienteComo("duena@salonceiba.test");
  recepcion = await clienteComo("recepcion@salonceiba.test");
  const { data } = await servicio
    .from("servicios")
    .select("id")
    .eq("nombre", "Manicure tradicional")
    .single();
  manicure = data!.id;
});

afterAll(async () => {
  if (citas.length) await servicio.from("citas").delete().in("id", citas);
  if (campanas.length)
    await servicio.from("campanas").delete().in("id", campanas);
  await servicio.from("campanas").delete().like("asunto", `${ASUNTO}%`);
  if (audiencias.length)
    await servicio.from("audiencias").delete().in("id", audiencias);
  if (clientesConCanje.length)
    await servicio
      .from("canjes_sellos")
      .delete()
      .in("cliente_id", clientesConCanje)
      .gte("created_at", new Date(Date.now() - 3600_000).toISOString());
  await servicio
    .from("ajustes")
    .update({ sellos_activos: true })
    .eq("negocio_id", NEGOCIO_DEMO);
});

describe("marketing sin permiso", () => {
  it("el público no ve nada y la recepción no ve ni envía campañas", async () => {
    const anon = clienteAnonimo();
    for (const tabla of [
      "audiencias",
      "campanas",
      "sellos",
      "plantillas_whatsapp",
    ] as const) {
      const { data } = await anon.from(tabla).select("id");
      expect(data ?? []).toEqual([]);
    }
    const { data } = await recepcion.from("campanas").select("id");
    expect(data).toEqual([]);
    const { error } = await recepcion.rpc("contar_audiencia", {
      p_filtro: {},
    });
    expect(error).not.toBeNull();
    const { data: enviadas } = await duena
      .from("campanas")
      .select("id")
      .eq("estado", "borrador")
      .limit(1)
      .single();
    const { data: envio } = await recepcion.rpc("enviar_campana", {
      p_campana: enviadas!.id,
    });
    expect((envio as unknown as Respuesta).error?.code).toBe("SIN_PERMISO");
  });
});

describe("audiencias con sus cifras", () => {
  it("una sola llamada da lo mismo que contar cada audiencia, y solo para el dueño", async () => {
    const filtros = [{}, { genero: "femenino" }, { sinVenirDias: 30 }];
    for (const [i, filtro] of filtros.entries()) {
      const { data } = await duena
        .from("audiencias")
        .insert({
          negocio_id: NEGOCIO_DEMO,
          nombre: `Prueba marketing cifras ${i}`,
          filtro,
        })
        .select("id")
        .single();
      audiencias.push(data!.id);
    }
    const { data, error } = await duena.rpc("audiencias_con_conteo");
    expect(error).toBeNull();
    const filas = (
      data as unknown as {
        id: string;
        filtro: Record<string, unknown>;
        total: number;
        reciben: number;
        sinCorreo: number;
        suprimidos: number;
      }[]
    ).filter((f) => audiencias.includes(f.id));
    expect(filas).toHaveLength(filtros.length);
    for (const f of filas) {
      const { data: c } = await duena.rpc("contar_audiencia", {
        p_filtro: f.filtro as Json,
      });
      const uno = c as unknown as Omit<typeof f, "id" | "filtro">;
      expect([f.total, f.reciben, f.sinCorreo, f.suprimidos]).toEqual([
        uno.total,
        uno.reciben,
        uno.sinCorreo,
        uno.suprimidos,
      ]);
    }
    const sinPermiso = await recepcion.rpc("audiencias_con_conteo");
    expect(sinPermiso.error?.code).toBe("42501");
    const anonimo = await clienteAnonimo().rpc("audiencias_con_conteo");
    expect(anonimo.error).not.toBeNull();
  });
});

describe("campañas", () => {
  it("llega al buzón de quien tiene correo y no la suprimió, con su nombre", async () => {
    const { data: aud } = await duena
      .from("audiencias")
      .insert({
        negocio_id: NEGOCIO_DEMO,
        nombre: "Prueba marketing clientas",
        filtro: { genero: "femenino" },
      })
      .select("id")
      .single();
    audiencias.push(aud!.id);
    const { data: conteo } = await duena.rpc("contar_audiencia", {
      p_filtro: { genero: "femenino" },
    });
    const c = conteo as unknown as { reciben: number; suprimidos: number };
    expect(c.suprimidos).toBeGreaterThan(0);
    const id = await crearCampana(aud!.id);
    const { data } = await duena.rpc("enviar_campana", { p_campana: id });
    const r = data as unknown as Respuesta;
    expect(r).toMatchObject({ ok: true, destinatarios: c.reciben });

    const { data: avisos } = await duena
      .from("avisos_demo")
      .select("destinatario, destino, cuerpo, tipo, canal")
      .eq("campana_id", id);
    expect(avisos).toHaveLength(c.reciben);
    const a = avisos![0];
    expect(a).toMatchObject({ tipo: "campana", canal: "correo" });
    expect(a.cuerpo).toBe(
      `Hola ${a.destinatario!.split(" ")[0]}, esto es una prueba.`,
    );
    const { data: suprimidos } = await servicio
      .from("clientes")
      .select("correo")
      .eq("recibe_campanas", false);
    const destinos = avisos!.map((x) => x.destino);
    for (const s of suprimidos!) expect(destinos).not.toContain(s.correo);

    const otra = await duena.rpc("enviar_campana", { p_campana: id });
    expect((otra.data as unknown as Respuesta).error?.code).toBe(
      "NO_ENCONTRADA",
    );
    const { data: editada } = await duena
      .from("campanas")
      .update({ asunto: `${ASUNTO} editada` })
      .eq("id", id)
      .select("id");
    expect(editada).toEqual([]);
  });

  it("no se envía sin destinatarios ni por encima del cupo del mes", async () => {
    const { data: aud } = await duena
      .from("audiencias")
      .insert({
        negocio_id: NEGOCIO_DEMO,
        nombre: "Prueba marketing nadie",
        filtro: { genero: "otro" },
      })
      .select("id")
      .single();
    audiencias.push(aud!.id);
    const vacia = await crearCampana(aud!.id);
    const { data: r1 } = await duena.rpc("enviar_campana", {
      p_campana: vacia,
    });
    expect((r1 as unknown as Respuesta).error?.code).toBe("SIN_DESTINATARIOS");

    const { data: conteo } = await duena.rpc("contar_audiencia", {
      p_filtro: {},
    });
    const c = conteo as unknown as { usadosMes: number; cupoMes: number };
    const { data: relleno } = await servicio
      .from("campanas")
      .insert({
        negocio_id: NEGOCIO_DEMO,
        asunto: `${ASUNTO} relleno`,
        cuerpo: "Relleno del cupo",
        estado: "enviada",
        enviada_at: new Date().toISOString(),
        destinatarios: c.cupoMes - c.usadosMes - 5,
      })
      .select("id")
      .single();
    campanas.push(relleno!.id);
    const todos = await crearCampana(null);
    const { data: r2 } = await duena.rpc("enviar_campana", {
      p_campana: todos,
    });
    expect((r2 as unknown as Respuesta).error).toMatchObject({
      code: "CUPO",
      message: expect.stringMatching(
        /^Este mes quedan 5 envíos y la campaña necesita \d+$/,
      ),
    });
  });
});

describe("tarjeta de sellos", () => {
  it("cada asistencia suma un sello, se quita al corregirla y al llenar la tarjeta llega el aviso", async () => {
    const { data: tarjetas } = await duena.rpc("tarjetas_sellos");
    const casi = tarjetas!.find(
      (t) =>
        t.sellos % 8 === 7 &&
        Math.floor(t.sellos / 8) === t.canjes &&
        t.telefono,
    )!;
    clientesConCanje.push(casi.cliente_id);
    const cita = await nuevaCita(casi.cliente_id, "12:00");
    await estado(cita, "asiste");
    expect(await sellosDe(casi.cliente_id)).toBe(casi.sellos + 1);
    const { data: aviso } = await duena
      .from("avisos_demo")
      .select("asunto, cuerpo")
      .eq("cita_id", cita)
      .eq("tipo", "sellos")
      .single();
    expect(aviso!.asunto).toBe("¡Completaste tu tarjeta!");
    expect(aviso!.cuerpo).toContain("Un manicure tradicional de cortesía");

    const premio = await recepcion.rpc("canjear_premio", {
      p_cliente: casi.cliente_id,
    });
    expect((premio.data as unknown as Respuesta).ok).toBe(true);
    const otro = await recepcion.rpc("canjear_premio", {
      p_cliente: casi.cliente_id,
    });
    expect((otro.data as unknown as Respuesta).error?.code).toBe("SIN_PREMIO");

    await estado(cita, "reservado");
    expect(await sellosDe(casi.cliente_id)).toBe(casi.sellos);
  });

  it("con el programa apagado no suma sellos", async () => {
    await servicio
      .from("ajustes")
      .update({ sellos_activos: false })
      .eq("negocio_id", NEGOCIO_DEMO);
    const { data: cl } = await servicio
      .from("clientes")
      .select("id")
      .eq("numero_cliente", "0003")
      .single();
    const antes = await sellosDe(cl!.id);
    const cita = await nuevaCita(cl!.id, "14:00");
    await estado(cita, "asiste");
    expect(await sellosDe(cl!.id)).toBe(antes);
    await servicio
      .from("ajustes")
      .update({ sellos_activos: true })
      .eq("negocio_id", NEGOCIO_DEMO);
  });
});

describe("plantillas de WhatsApp", () => {
  it("la recepción manda una plantilla con los datos de la cita; la apagada no sale", async () => {
    const { data: cl } = await servicio
      .from("clientes")
      .select("id, nombre, telefono")
      .eq("numero_cliente", "0004")
      .single();
    const cita = await nuevaCita(cl!.id, "16:00");
    const { data: plantillas } = await recepcion
      .from("plantillas_whatsapp")
      .select("id, nombre, activo");
    const confirmar = plantillas!.find(
      (t) => t.nombre === "Confirmar asistencia",
    )!;
    const apagada = plantillas!.find((t) => !t.activo)!;
    const { data } = await recepcion.rpc("enviar_plantilla", {
      p_cita: cita,
      p_plantilla: confirmar.id,
    });
    expect((data as unknown as Respuesta).ok).toBe(true);
    const { data: aviso } = await recepcion
      .from("avisos_demo")
      .select("canal, destino, cuerpo")
      .eq("cita_id", cita)
      .eq("tipo", "plantilla")
      .single();
    const fecha = miercoles().split("-").reverse().join("/");
    expect(aviso).toEqual({
      canal: "whatsapp",
      destino: cl!.telefono,
      cuerpo: `Hola ${cl!.nombre}, te escribimos de Salón Ceiba. ¿Nos confirmas tu cita de Manicure tradicional el ${fecha} a las 16:00 con Valentina Ospina?`,
    });
    const { data: r2 } = await recepcion.rpc("enviar_plantilla", {
      p_cita: cita,
      p_plantilla: apagada.id,
    });
    expect((r2 as unknown as Respuesta).error?.code).toBe("NO_ENCONTRADA");
  });

  it("sin teléfono no se manda; un profesional no manda ni la recepción escribe plantillas", async () => {
    const { data: sinTel } = await servicio
      .from("clientes")
      .select("id")
      .is("telefono", null)
      .limit(1)
      .single();
    const cita = await nuevaCita(sinTel!.id, "10:00");
    const { data: plantilla } = await recepcion
      .from("plantillas_whatsapp")
      .select("id")
      .eq("activo", true)
      .limit(1)
      .single();
    const { data } = await recepcion.rpc("enviar_plantilla", {
      p_cita: cita,
      p_plantilla: plantilla!.id,
    });
    expect((data as unknown as Respuesta).error?.code).toBe("SIN_TELEFONO");
    const valentina = await clienteComo("valentina@salonceiba.test");
    const { data: r2 } = await valentina.rpc("enviar_plantilla", {
      p_cita: cita,
      p_plantilla: plantilla!.id,
    });
    expect((r2 as unknown as Respuesta).error?.code).toBe("SIN_PERMISO");
    const { error } = await recepcion.from("plantillas_whatsapp").insert({
      negocio_id: NEGOCIO_DEMO,
      nombre: "Prueba marketing pirata",
      cuerpo: "Hola",
    });
    expect(error).not.toBeNull();
  });
});
