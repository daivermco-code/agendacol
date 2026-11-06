import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  clienteAnonimo,
  clienteComo,
  clienteServicio,
  NEGOCIO_DEMO,
} from "./ayuda";

// Ajustes → Sitio web y Avanzadas: reglas de la reserva en línea, del enlace del cliente y avisos al equipo.
type Cliente = SupabaseClient<Database>;
type Ajustes = Database["public"]["Tables"]["ajustes"]["Update"];
interface Respuesta {
  ok: boolean;
  token?: string;
  error?: { code: string; message: string };
}
interface Dia {
  fecha: string;
  horas: string[];
}

const SLUG = "salon-ceiba";
const APELLIDO = "Integración sitio";
const VALENTINA = "b0000000-0000-4000-8000-000000000003";
const CLAVES = [
  "web_anticipacion_min",
  "web_dias_max",
  "web_cliente_cancela",
  "web_cliente_cambia",
  "web_limite_horas",
  "web_politica",
  "red_instagram",
  "red_facebook",
  "red_tiktok",
  "aviso_equipo_reserva",
  "aviso_equipo_cambios",
  "aviso_equipo_correo",
] as const;

const anon = clienteAnonimo();
const servicio = clienteServicio();
let duena: Cliente;
let original: Ajustes;
let servicioId: string;
let numero = 0;

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Lunes dentro de 7 semanas + n días: fuera de la semilla y de las fechas de publico.test. */
function dia(n: number): string {
  const hoy = new Date();
  return iso(
    new Date(
      hoy.getFullYear(),
      hoy.getMonth(),
      hoy.getDate() - ((hoy.getDay() + 6) % 7) + 49 + n,
    ),
  );
}

/** Fecha y hora de ahora en Bogotá (la zona del local). */
function ahoraBogota() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const v = (t: string) => partes.find((p) => p.type === t)!.value;
  const fecha = `${v("year")}-${v("month")}-${v("day")}`;
  const manana = new Date(`${fecha}T12:00:00Z`);
  manana.setUTCDate(manana.getUTCDate() + 1);
  return {
    fecha,
    manana: manana.toISOString().slice(0, 10),
    hora: `${v("hour")}:${v("minute")}`,
  };
}

const ddmmyyyy = (f: string) => f.split("-").reverse().join("/");

async function ajustar(c: Ajustes) {
  const { error } = await duena
    .from("ajustes")
    .update(c)
    .eq("negocio_id", NEGOCIO_DEMO);
  if (error) throw new Error(error.message);
}

async function horas(desde: string, dias: number): Promise<Dia[]> {
  const { data, error } = await anon.rpc("publico_disponibilidad", {
    p_slug: SLUG,
    p_servicios: [servicioId],
    p_profesional: VALENTINA,
    p_desde: desde,
    p_dias: dias,
  });
  if (error) throw new Error(error.message);
  return data as unknown as Dia[];
}

async function reservar(fecha: string, hora: string): Promise<Respuesta> {
  numero += 1;
  const { data, error } = await anon.rpc("publico_reservar", {
    p: {
      slug: SLUG,
      nombre: "Prueba",
      apellido: APELLIDO,
      correo: `sitio${numero}@ejemplo.test`,
      telefono: `+57399100${String(numero).padStart(4, "0")}`,
      autoriza: true,
      servicios: [servicioId],
      profesionalId: VALENTINA,
      fecha,
      hora,
    },
  });
  if (error) throw new Error(error.message);
  return data as unknown as Respuesta;
}

async function citaPublica(token: string) {
  const { data } = await anon.rpc("publico_cita", { p_token: token });
  return data as unknown as Record<string, unknown> | null;
}

async function idDe(token: string) {
  const { data } = await servicio
    .from("citas")
    .select("id")
    .eq("token", token)
    .single();
  return data!.id;
}

async function avisosEquipo(citaId: string) {
  const { data } = await servicio
    .from("avisos_demo")
    .select("asunto, destino, cuerpo")
    .eq("tipo", "equipo")
    .eq("cita_id", citaId)
    .order("created_at");
  return data ?? [];
}

async function limpiar() {
  const { data: clientes } = await servicio
    .from("clientes")
    .select("id")
    .eq("negocio_id", NEGOCIO_DEMO)
    .eq("apellido", APELLIDO);
  const ids = (clientes ?? []).map((c) => c.id);
  if (ids.length === 0) return;
  const { data: citas } = await servicio
    .from("citas")
    .select("id")
    .in("cliente_id", ids);
  const citaIds = (citas ?? []).map((c) => c.id);
  if (citaIds.length > 0) {
    await servicio.from("avisos_demo").delete().in("cita_id", citaIds);
    await servicio.from("citas").delete().in("id", citaIds);
  }
  await servicio.from("clientes").delete().in("id", ids);
}

beforeAll(async () => {
  duena = await clienteComo("duena@salonceiba.test");
  await limpiar();
  const { data } = await servicio
    .from("ajustes")
    .select(CLAVES.join(", "))
    .eq("negocio_id", NEGOCIO_DEMO)
    .single();
  original = data as unknown as Ajustes;
  const { data: portada } = await anon.rpc("publico_negocio", {
    p_slug: SLUG,
  });
  const p = portada as unknown as {
    servicios: { id: string; duracion: number }[];
    profesionales: { id: string; servicios: string[] }[];
  };
  const suyos = p.profesionales.find((x) => x.id === VALENTINA)!.servicios;
  servicioId = p.servicios.find(
    (s) => suyos.includes(s.id) && s.duracion >= 30 && s.duracion <= 60,
  )!.id;
  await ajustar({
    web_anticipacion_min: 30,
    web_dias_max: 60,
    web_cliente_cancela: true,
    web_cliente_cambia: true,
    web_limite_horas: 0,
    aviso_equipo_reserva: true,
    aviso_equipo_cambios: true,
    aviso_equipo_correo: null,
  });
});

afterAll(async () => {
  await limpiar();
  await ajustar(original);
});

describe("reglas de la reserva en línea", () => {
  it("la anticipación mínima esconde las horas cercanas", async () => {
    await ajustar({ web_anticipacion_min: 1440 });
    const ahora = ahoraBogota();
    const [hoy, manana] = await horas(ahora.fecha, 2);
    expect(hoy.horas).toEqual([]);
    expect(manana.fecha).toBe(ahora.manana);
    expect(manana.horas.every((h) => h >= ahora.hora)).toBe(true);
    await ajustar({ web_anticipacion_min: 30 });
  });

  it("los días máximos cortan el calendario y la reserva", async () => {
    await ajustar({ web_dias_max: 14 });
    expect(await horas(dia(0), 1)).toEqual([]);
    expect((await reservar(dia(0), "10:00")).error?.code).toBe("OCUPADA");
    await ajustar({ web_dias_max: 60 });
    expect((await horas(dia(0), 1))[0].horas).toContain("10:00");
    expect((await reservar(dia(0), "10:00")).ok).toBe(true);
  });
});

describe("enlace del cliente", () => {
  it("si el negocio no deja cancelar ni cambiar en línea, lo explica y no lo hace", async () => {
    const r = await reservar(dia(4), "10:00");
    const token = r.token!;
    await ajustar({ web_cliente_cancela: false, web_cliente_cambia: false });
    expect(await citaPublica(token)).toMatchObject({
      activa: true,
      puedeCancelar: false,
      puedeCambiar: false,
      reglas: { cancela: false, cambia: false, limiteHoras: 0 },
    });
    const { data: cancela } = await anon.rpc("publico_cancelar_cita", {
      p_token: token,
    });
    expect(cancela).toMatchObject({
      ok: false,
      error: {
        code: "NO_SE_PUEDE",
        message: "Para cancelar esta cita, comunícate con el negocio",
      },
    });
    const { data: cambia } = await anon.rpc("publico_cambiar_cita", {
      p_token: token,
      p_fecha: dia(4),
      p_hora: "15:00",
    });
    expect(cambia).toMatchObject({
      ok: false,
      error: { message: "Para cambiar esta cita, comunícate con el negocio" },
    });
  });

  it("pasado el límite de horas, el cliente ya no cancela en línea", async () => {
    const r = await reservar(dia(3), "10:00");
    const token = r.token!;
    await ajustar({
      web_cliente_cancela: true,
      web_cliente_cambia: true,
      web_limite_horas: 48,
    });
    expect((await citaPublica(token))?.puedeCancelar).toBe(true);
    // La cita pasa a mañana a las 10:00: siempre a menos de 48 horas.
    await servicio
      .from("citas")
      .update({ fecha: ahoraBogota().manana })
      .eq("id", await idDe(token));
    expect(await citaPublica(token)).toMatchObject({
      activa: true,
      puedeCancelar: false,
      puedeCambiar: false,
    });
    const { data } = await anon.rpc("publico_cancelar_cita", {
      p_token: token,
    });
    expect(data).toMatchObject({
      ok: false,
      error: {
        message:
          "En línea se cancela hasta 48 horas antes. Comunícate con el negocio",
      },
    });
    await ajustar({ web_limite_horas: 0 });
    const { data: ahora } = await anon.rpc("publico_cancelar_cita", {
      p_token: token,
    });
    expect(ahora).toMatchObject({ ok: true });
  });
});

describe("avisos al equipo", () => {
  it("llega un correo al reservar, cambiar y cancelar en línea", async () => {
    const r = await reservar(dia(1), "11:00");
    const token = r.token!;
    const id = await idDe(token);
    const [reserva] = await avisosEquipo(id);
    expect(reserva).toMatchObject({
      asunto: "Nueva reserva en línea",
      destino: "hola@salonceiba.test",
    });
    expect(reserva.cuerpo).toContain(`Prueba ${APELLIDO} reservó en línea: `);
    expect(reserva.cuerpo).toContain(`el ${ddmmyyyy(dia(1))} a las 11:00`);

    await ajustar({ aviso_equipo_correo: "equipo@ejemplo.test" });
    await anon.rpc("publico_cambiar_cita", {
      p_token: token,
      p_fecha: dia(2),
      p_hora: "15:00",
    });
    await anon.rpc("publico_cancelar_cita", { p_token: token });
    const [, cambio, cancelacion] = await avisosEquipo(id);
    expect(cambio).toMatchObject({
      asunto: "Un cliente cambió su cita",
      destino: "equipo@ejemplo.test",
    });
    expect(cambio.cuerpo).toContain(`el ${ddmmyyyy(dia(2))} a las 15:00`);
    expect(cancelacion.asunto).toBe("Un cliente canceló su cita");
  });

  it("apagados, no llega nada", async () => {
    await ajustar({ aviso_equipo_reserva: false, aviso_equipo_cambios: false });
    const r = await reservar(dia(2), "10:00");
    await anon.rpc("publico_cancelar_cita", { p_token: r.token! });
    expect(await avisosEquipo(await idDe(r.token!))).toEqual([]);
  });
});

describe("el sitio", () => {
  it("muestra las reglas, la política y las redes; recepción no las cambia", async () => {
    await ajustar({
      red_instagram: "salon.prueba",
      web_politica: "Política de prueba",
      web_dias_max: 30,
    });
    const { data } = await anon.rpc("publico_negocio", { p_slug: SLUG });
    expect(data).toMatchObject({
      reglas: {
        anticipacionMin: 30,
        diasMax: 30,
        politica: "Política de prueba",
        limiteHoras: 0,
        cancela: true,
        cambia: true,
      },
      redes: { instagram: "salon.prueba", facebook: null, tiktok: null },
    });

    const { error } = await duena
      .from("ajustes")
      .update({ red_instagram: "no vale!" })
      .eq("negocio_id", NEGOCIO_DEMO);
    expect(error?.code).toBe("23514");

    const recepcion = await clienteComo("recepcion@salonceiba.test");
    const { data: cambiadas } = await recepcion
      .from("ajustes")
      .update({ web_dias_max: 14 })
      .eq("negocio_id", NEGOCIO_DEMO)
      .select("negocio_id");
    expect(cambiadas ?? []).toEqual([]);
  });
});
