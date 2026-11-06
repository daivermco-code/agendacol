import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { clienteAnonimo, clienteComo, NEGOCIO_DEMO } from "./ayuda";

// Reserva en línea y enlace del cliente (funciones publico_*) contra Supabase local, sin sesión.
type Cliente = SupabaseClient<Database>;
interface Respuesta {
  ok: boolean;
  token?: string;
  error?: { code: string; message: string; field?: string };
}
interface Dia {
  fecha: string;
  abierto: boolean;
  horas: string[];
}
interface Portada {
  servicios: { id: string; nombre: string; duracion: number }[];
  profesionales: { id: string; nombre: string; servicios: string[] }[];
}
interface CitaPublica {
  estado: string;
  cliente: string;
  servicios: { nombre: string; inicio: string }[];
  puedeConfirmar: boolean;
  puedeCambiar: boolean;
  puedeCalificar: boolean;
  calificacion: { estrellas: number } | null;
  avisoCancelacion: string | null;
}

const SLUG = "salon-ceiba";
const APELLIDO = "Integración pública";
const CAROLINA = "b0000000-0000-4000-8000-000000000001";
const ANDRES = "b0000000-0000-4000-8000-000000000002";
const VALENTINA = "b0000000-0000-4000-8000-000000000003";
const JULIAN = "b0000000-0000-4000-8000-000000000004";

const anon = clienteAnonimo();
let duena: Cliente;
let recepcion: Cliente;
let portada: Portada;
let numero = 0;

/** Lunes dentro de 6 semanas + n días: fuera de la semilla y dentro de los 60 días de reserva. */
function dia(n: number): string {
  const hoy = new Date();
  const d = new Date(
    hoy.getFullYear(),
    hoy.getMonth(),
    hoy.getDate() - ((hoy.getDay() + 6) % 7) + 42 + n,
  );
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Un servicio de ese profesional que dure entre 30 y 60 minutos. */
function servicioDe(profesionalId: string) {
  const ids = portada.profesionales.find(
    (p) => p.id === profesionalId,
  )!.servicios;
  return portada.servicios.find(
    (s) => ids.includes(s.id) && s.duracion >= 30 && s.duracion <= 60,
  )!;
}

const minutos = (h: string) =>
  Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const reloj = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

async function horas(
  servicios: string[],
  profesionalId: string | null,
  fecha: string,
): Promise<Dia> {
  const { data, error } = await anon.rpc("publico_disponibilidad", {
    p_slug: SLUG,
    p_servicios: servicios,
    p_profesional: profesionalId as string,
    p_desde: fecha,
    p_dias: 1,
  });
  if (error) throw new Error(error.message);
  return (data as unknown as Dia[])[0];
}

async function reservar(p: Record<string, unknown>): Promise<Respuesta> {
  numero += 1;
  const { data, error } = await anon.rpc("publico_reservar", {
    p: {
      slug: SLUG,
      nombre: "Prueba",
      apellido: APELLIDO,
      correo: `publico${numero}@ejemplo.test`,
      telefono: `+57399000${String(numero).padStart(4, "0")}`,
      autoriza: true,
      profesionalId: "",
      ...p,
    },
  });
  if (error) throw new Error(error.message);
  return data as unknown as Respuesta;
}

async function citaPublica(token: string) {
  const { data } = await anon.rpc("publico_cita", { p_token: token });
  return data as unknown as CitaPublica | null;
}

/** Las citas de la reserva vistas por el equipo, por hora. */
async function delEquipo(token: string) {
  const { data: una } = await duena
    .from("citas")
    .select("reserva_id")
    .eq("token", token)
    .single();
  const { data } = await duena
    .from("citas")
    .select(
      "id, profesional_id, cliente_id, fecha, hora_inicio, estado, origen, motivo_cancelacion",
    )
    .eq("reserva_id", una!.reserva_id!)
    .order("hora_inicio");
  return data ?? [];
}

async function limpiar() {
  await duena
    .from("citas")
    .delete()
    .not("reserva_id", "is", null)
    .gte("fecha", dia(0))
    .lte("fecha", dia(6));
  await duena.from("bloqueos").delete().eq("motivo", APELLIDO);
  await duena
    .from("clientes")
    .delete()
    .eq("negocio_id", NEGOCIO_DEMO)
    .eq("apellido", APELLIDO);
}

beforeAll(async () => {
  duena = await clienteComo("duena@salonceiba.test");
  recepcion = await clienteComo("recepcion@salonceiba.test");
  await limpiar();
  const { data } = await anon.rpc("publico_negocio", { p_slug: SLUG });
  portada = data as unknown as Portada;
});

afterAll(limpiar);

describe("portada y horas libres", () => {
  it("muestra el negocio sin datos de clientes; un enlace de negocio que no existe no muestra nada", async () => {
    expect(portada.servicios).toHaveLength(20);
    expect(portada.profesionales).toHaveLength(4);
    expect(JSON.stringify(portada)).not.toMatch(/correo|@ejemplo/);
    const { data } = await anon.rpc("publico_negocio", { p_slug: "no-existe" });
    expect(data).toBeNull();
  });

  it("respeta el horario, el descanso, los bloqueos y las citas", async () => {
    const s = servicioDe(CAROLINA);
    const fecha = dia(0);
    const libre = await horas([s.id], CAROLINA, fecha);
    expect(libre.horas).toContain("09:00");
    expect(libre.horas).toContain("14:00");
    expect(libre.horas).not.toContain("13:00"); // descanso de 13 a 14
    expect(libre.horas.every((h) => minutos(h) + s.duracion <= 19 * 60)).toBe(
      true,
    );
    expect(
      libre.horas.some(
        (h) => minutos(h) < 14 * 60 && minutos(h) + s.duracion > 13 * 60,
      ),
    ).toBe(false);

    await duena.from("bloqueos").insert({
      negocio_id: NEGOCIO_DEMO,
      profesional_id: CAROLINA,
      motivo: APELLIDO,
      inicio: `${fecha}T15:00:00`,
      fin: `${fecha}T16:00:00`,
    });
    expect(
      (
        await reservar({
          servicios: [s.id],
          profesionalId: CAROLINA,
          fecha,
          hora: "10:00",
        })
      ).ok,
    ).toBe(true);
    const despues = await horas([s.id], CAROLINA, fecha);
    expect(despues.horas).not.toContain("15:00");
    expect(despues.horas).not.toContain("15:30");
    expect(despues.horas).not.toContain("10:00");
    expect(despues.horas).toContain("16:00");

    const domingo = await horas([s.id], CAROLINA, dia(6));
    expect(domingo).toMatchObject({ abierto: false, horas: [] });
  });
});

describe("reservar", () => {
  it("dos personas a la misma hora con el mismo profesional: solo una queda", async () => {
    const s = servicioDe(ANDRES);
    const fecha = dia(1);
    const [a, b] = await Promise.all([
      reservar({
        servicios: [s.id],
        profesionalId: ANDRES,
        fecha,
        hora: "12:00",
      }),
      reservar({
        servicios: [s.id],
        profesionalId: ANDRES,
        fecha,
        hora: "12:00",
      }),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect((a.ok ? b : a).error?.code).toBe("OCUPADA");
    const { data } = await duena
      .from("citas")
      .select("origen")
      .eq("profesional_id", ANDRES)
      .eq("fecha", fecha)
      .eq("hora_inicio", "12:00:00")
      .neq("estado", "cancelado");
    expect(data).toEqual([{ origen: "en_linea" }]);
  });

  it("con «cualquiera» la segunda reserva va a otro profesional libre", async () => {
    const s = portada.servicios.find(
      (x) =>
        portada.profesionales.filter((p) => p.servicios.includes(x.id))
          .length >= 2,
    )!;
    const fecha = dia(2);
    const a = await reservar({ servicios: [s.id], fecha, hora: "16:00" });
    const b = await reservar({ servicios: [s.id], fecha, hora: "16:00" });
    expect(a.ok && b.ok).toBe(true);
    const [ca] = await delEquipo(a.token!);
    const [cb] = await delEquipo(b.token!);
    expect(ca.profesional_id).not.toBe(cb.profesional_id);
  });

  it("es el mismo cliente solo si coinciden correo y teléfono", async () => {
    const { data: conocido } = await duena
      .from("clientes")
      .select("id, nombre, correo, telefono")
      .not("correo", "is", null)
      .not("telefono", "is", null)
      .limit(1)
      .single();
    const s = servicioDe(CAROLINA);
    const mismo = await reservar({
      servicios: [s.id],
      profesionalId: CAROLINA,
      fecha: dia(4),
      hora: "09:00",
      correo: conocido!.correo,
      telefono: conocido!.telefono,
    });
    expect((await citaPublica(mismo.token!))?.cliente).toBe(conocido!.nombre);
    const otro = await reservar({
      servicios: [s.id],
      profesionalId: CAROLINA,
      fecha: dia(4),
      hora: "10:00",
      telefono: conocido!.telefono,
    });
    expect((await citaPublica(otro.token!))?.cliente).toBe("Prueba");
    expect((await delEquipo(otro.token!))[0].cliente_id).not.toBe(conocido!.id);
  });

  it("valida los datos y no deja reservar en el pasado ni a deshoras", async () => {
    const s = servicioDe(CAROLINA);
    const base = {
      servicios: [s.id],
      profesionalId: CAROLINA,
      fecha: dia(4),
      hora: "11:00",
    };
    expect((await reservar({ ...base, autoriza: false })).error?.field).toBe(
      "autoriza",
    );
    expect((await reservar({ ...base, telefono: "123" })).error?.field).toBe(
      "telefono",
    );
    expect((await reservar({ ...base, hora: "11:15" })).error?.code).toBe(
      "VALIDACION",
    );
    expect((await reservar({ ...base, fecha: "2020-01-06" })).error?.code).toBe(
      "OCUPADA",
    );
    expect((await reservar({ ...base, hora: "20:00" })).error?.code).toBe(
      "OCUPADA",
    );
  });
});

describe("enlace del cliente", () => {
  it("confirma, cambia y cancela la reserva entera, y el equipo lo ve", async () => {
    const s = servicioDe(VALENTINA);
    const r = await reservar({
      servicios: [s.id, s.id],
      profesionalId: VALENTINA,
      fecha: dia(3),
      hora: "10:00",
    });
    const token = r.token!;
    const cita = await citaPublica(token);
    expect(cita).toMatchObject({
      estado: "reservado",
      puedeConfirmar: true,
      puedeCambiar: true,
    });
    expect(cita!.servicios).toHaveLength(2);
    const { data: aviso } = await duena
      .from("avisos_demo")
      .select("enlace")
      .eq("tipo", "confirmacion")
      .eq("enlace", `/cita/${token}`);
    expect(aviso!.length).toBeGreaterThan(0);

    await anon.rpc("publico_confirmar_cita", { p_token: token });
    expect((await delEquipo(token)).map((c) => c.estado)).toEqual([
      "confirmado",
      "confirmado",
    ]);

    const { data: libres } = await anon.rpc("publico_horas_cita", {
      p_token: token,
      p_desde: dia(4),
      p_dias: 1,
    });
    expect((libres as unknown as Dia[])[0].horas).toContain("15:00");
    const { data: cambio } = await anon.rpc("publico_cambiar_cita", {
      p_token: token,
      p_fecha: dia(4),
      p_hora: "15:00",
    });
    expect(cambio).toMatchObject({ ok: true });
    const movidas = await delEquipo(token);
    expect(movidas.map((c) => [c.fecha, c.hora_inicio.slice(0, 5)])).toEqual([
      [dia(4), "15:00"],
      [dia(4), reloj(15 * 60 + s.duracion)],
    ]);

    const { data: cancelada } = await anon.rpc("publico_cancelar_cita", {
      p_token: token,
      p_motivo: "Viaje",
    });
    expect(cancelada).toMatchObject({ ok: true });
    const finales = await delEquipo(token);
    expect(
      finales.every(
        (c) =>
          c.estado === "cancelado" &&
          c.motivo_cancelacion === "Cancelada por el cliente: Viaje",
      ),
    ).toBe(true);
    expect(await citaPublica(token)).toMatchObject({
      estado: "cancelado",
      puedeCambiar: false,
      avisoCancelacion: "La cancelaste: Viaje",
    });
    const { data: otraVez } = await anon.rpc("publico_cancelar_cita", {
      p_token: token,
    });
    expect(otraVez).toMatchObject({
      ok: false,
      error: { code: "NO_SE_PUEDE" },
    });
  });

  it("un enlace que no existe no muestra nada", async () => {
    expect(await citaPublica("abc")).toBeNull();
    expect(await citaPublica("0".repeat(32))).toBeNull();
    const { data } = await anon.rpc("publico_cancelar_cita", {
      p_token: "f".repeat(32),
    });
    expect(data).toMatchObject({ ok: false, error: { code: "NO_ENCONTRADA" } });
  });

  it("si cancela el negocio, el cliente no ve la nota interna", async () => {
    const s = servicioDe(JULIAN);
    const r = await reservar({
      servicios: [s.id],
      profesionalId: JULIAN,
      fecha: dia(5),
      hora: "16:00",
    });
    expect(r.ok).toBe(true);
    const [cita] = await delEquipo(r.token!);
    const { data } = await duena.rpc("cancelar_cita", {
      p_cita: cita.id,
      p_alcance: "solo_esta",
      p_motivo: "No ha pagado la última vez",
    });
    expect(data).toMatchObject({ ok: true });
    const vista = await citaPublica(r.token!);
    expect(vista!.avisoCancelacion).toBe(
      "El negocio canceló esta cita. Si quieres, agenda otra hora.",
    );
    expect(JSON.stringify(vista)).not.toContain("No ha pagado");
  });
});

describe("calificación del profesional", () => {
  it("solo después de «Asiste», una vez, y la ve el negocio y ese profesional", async () => {
    const r = await reservar({
      servicios: [servicioDe(CAROLINA).id],
      profesionalId: CAROLINA,
      fecha: dia(4),
      hora: "16:00",
    });
    const token = r.token!;
    const antes = await anon.rpc("publico_calificar", {
      p_token: token,
      p_estrellas: 5,
    });
    expect(antes.data).toMatchObject({
      ok: false,
      error: { code: "NO_SE_PUEDE" },
    });

    const [cita] = await delEquipo(token);
    await recepcion.rpc("cambiar_estado_cita", {
      p_cita: cita.id,
      p_estado: "asiste",
    });
    const { data: pedido } = await duena
      .from("avisos_demo")
      .select("id")
      .eq("cita_id", cita.id)
      .eq("tipo", "calificacion");
    expect(pedido!.length).toBeGreaterThan(0);
    expect((await citaPublica(token))?.puedeCalificar).toBe(true);

    const { data: ok } = await anon.rpc("publico_calificar", {
      p_token: token,
      p_estrellas: 5,
      p_comentario: "Excelente",
    });
    expect(ok).toMatchObject({ ok: true });
    const { data: dos } = await anon.rpc("publico_calificar", {
      p_token: token,
      p_estrellas: 1,
    });
    expect(dos).toMatchObject({ ok: false, error: { code: "YA_CALIFICADA" } });
    expect(await citaPublica(token)).toMatchObject({
      puedeCalificar: false,
      calificacion: { estrellas: 5 },
    });

    const { data: vista } = await duena
      .from("calificaciones")
      .select("estrellas, comentario")
      .eq("cita_id", cita.id);
    expect(vista).toEqual([{ estrellas: 5, comentario: "Excelente" }]);
    const carolina = await clienteComo("carolina@salonceiba.test");
    const andres = await clienteComo("andres@salonceiba.test");
    expect(
      (
        await carolina
          .from("calificaciones")
          .select("cita_id")
          .eq("cita_id", cita.id)
      ).data,
    ).toHaveLength(1);
    expect(
      (
        await andres
          .from("calificaciones")
          .select("cita_id")
          .eq("cita_id", cita.id)
      ).data,
    ).toHaveLength(0);
  });
});

describe("buzón de la demo", () => {
  it("«Responder: Confirmo» confirma la cita y deja la respuesta del cliente", async () => {
    const r = await reservar({
      servicios: [servicioDe(JULIAN).id],
      profesionalId: JULIAN,
      fecha: dia(5),
      hora: "12:00",
    });
    const [cita] = await delEquipo(r.token!);
    const { data: avisos } = await recepcion
      .from("avisos_demo")
      .select("id")
      .eq("cita_id", cita.id)
      .eq("canal", "whatsapp")
      .eq("tipo", "confirmacion");
    const aviso = avisos![0].id;

    const julian = await clienteComo("julian@salonceiba.test");
    expect(
      (await julian.rpc("responder_aviso_demo", { p_aviso: aviso })).data,
    ).toMatchObject({
      ok: false,
      error: { code: "SIN_PERMISO" },
    });
    expect(
      (await anon.rpc("responder_aviso_demo", { p_aviso: aviso })).error,
    ).not.toBeNull();
    // El recordatorio todavía no ha salido: no hay nada que responder.
    const { data: recordatorio } = await recepcion
      .from("avisos_demo")
      .select("id, estado")
      .eq("cita_id", cita.id)
      .eq("canal", "whatsapp")
      .eq("tipo", "recordatorio")
      .single();
    expect(recordatorio!.estado).toBe("programado");
    expect(
      (
        await recepcion.rpc("responder_aviso_demo", {
          p_aviso: recordatorio!.id,
        })
      ).data,
    ).toMatchObject({ ok: false, error: { code: "NO_SE_PUEDE" } });

    expect(
      (await recepcion.rpc("responder_aviso_demo", { p_aviso: aviso })).data,
    ).toMatchObject({ ok: true });
    expect((await delEquipo(r.token!))[0].estado).toBe("confirmado");
    const { data: respuesta } = await recepcion
      .from("avisos_demo")
      .select("estado")
      .eq("cita_id", cita.id)
      .eq("tipo", "respuesta");
    expect(respuesta).toEqual([{ estado: "recibido" }]);
    expect(
      (await recepcion.rpc("responder_aviso_demo", { p_aviso: aviso })).data,
    ).toMatchObject({
      ok: false,
      error: { code: "NO_SE_PUEDE" },
    });
  });
});

describe("permisos sin sesión", () => {
  it("anónimo no toca tablas ni funciones internas", async () => {
    expect(
      (await anon.from("citas").select("id").limit(1)).error,
    ).not.toBeNull();
    expect(
      (await anon.from("calificaciones").select("cita_id").limit(1)).error,
    ).not.toBeNull();
    const { error } = await anon.rpc("plan_reserva", {
      p_slug: SLUG,
      p_servicios: [],
      p_profesional: CAROLINA,
    });
    expect(error).not.toBeNull();
  });
});
