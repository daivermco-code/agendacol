import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  clienteAnonimo,
  clienteComo,
  clienteServicio,
  NEGOCIO_DEMO,
} from "./ayuda";

// "Mis citas" con código de 6 números y lista de espera (0014) contra Supabase local.
type Cliente = SupabaseClient<Database>;
interface Respuesta {
  ok: boolean;
  token?: string;
  canal?: string;
  destino?: string;
  error?: { code: string; message: string; field?: string };
}
interface MisCitas {
  cliente: string;
  destino: string;
  proximas: { token: string }[];
  historial: { token: string }[];
  esperas: { id: string; estado: string; enlace: string; franja: string }[];
}

const SLUG = "salon-ceiba";
const APELLIDO = "Integración espera";
const VALENTINA = "b0000000-0000-4000-8000-000000000003";
const ANA = "ana.sanchez1@ejemplo.test";
const NADIE = "nadie.mis-citas@ejemplo.test";
const CORREO_ESPERA = "espera.mis-citas@ejemplo.test";
const TEL_ESPERA = "+573991200001";
const DESTINOS = [ANA, NADIE, CORREO_ESPERA, "+573000000002"];

const anon = clienteAnonimo();
const servicio = clienteServicio();
let duena: Cliente;
let servicioId: string;
let numero = 0;

/** Lunes dentro de 7 semanas + n días: fuera de la semilla. */
function dia(n: number): string {
  const hoy = new Date();
  const d = new Date(
    hoy.getFullYear(),
    hoy.getMonth(),
    hoy.getDate() - ((hoy.getDay() + 6) % 7) + 49 + n,
  );
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function pedir(dato: string): Promise<Respuesta> {
  const { data, error } = await anon.rpc("publico_pedir_codigo", {
    p_slug: SLUG,
    p_dato: dato,
  });
  if (error) throw new Error(error.message);
  return data as unknown as Respuesta;
}

async function entrar(dato: string, codigo: string): Promise<Respuesta> {
  const { data, error } = await anon.rpc("publico_entrar_codigo", {
    p_slug: SLUG,
    p_dato: dato,
    p_codigo: codigo,
  });
  if (error) throw new Error(error.message);
  return data as unknown as Respuesta;
}

/** El código que llegó al buzón (el último enviado a ese destino). */
async function codigoDe(destino: string): Promise<string | null> {
  const { data } = await servicio
    .from("avisos_demo")
    .select("cuerpo")
    .eq("tipo", "codigo")
    .eq("destino", destino)
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0]?.cuerpo.match(/ es (\d{6})\./)?.[1] ?? null;
}

async function misCitas(token: string) {
  const { data } = await anon.rpc("publico_mis_citas", { p_token: token });
  return data as unknown as MisCitas | null;
}

async function anotar(p: Record<string, unknown>): Promise<Respuesta> {
  const { data, error } = await anon.rpc("publico_lista_espera", {
    p: {
      slug: SLUG,
      nombre: "Prueba",
      apellido: APELLIDO,
      correo: CORREO_ESPERA,
      telefono: TEL_ESPERA,
      autoriza: true,
      servicios: [servicioId],
      profesionalId: VALENTINA,
      franja: "dia",
      ...p,
    },
  });
  if (error) throw new Error(error.message);
  return data as unknown as Respuesta;
}

async function reservarOtro(fecha: string, hora: string) {
  numero += 1;
  const { data } = await anon.rpc("publico_reservar", {
    p: {
      slug: SLUG,
      nombre: "Otra",
      apellido: APELLIDO,
      correo: `otra${numero}.mis-citas@ejemplo.test`,
      telefono: `+57399120${String(numero).padStart(4, "0")}`,
      autoriza: true,
      servicios: [servicioId],
      profesionalId: VALENTINA,
      fecha,
      hora,
    },
  });
  return (data as unknown as Respuesta).token!;
}

async function esperasDe(fecha: string) {
  const { data } = await servicio
    .from("lista_espera")
    .select("id, estado, franja")
    .eq("fecha", fecha)
    .in(
      "cliente_id",
      (await clientesDePrueba()).map((c) => c.id),
    );
  return data ?? [];
}

async function clientesDePrueba() {
  const { data } = await servicio
    .from("clientes")
    .select("id")
    .eq("negocio_id", NEGOCIO_DEMO)
    .eq("apellido", APELLIDO);
  return data ?? [];
}

async function limpiar() {
  const ids = (await clientesDePrueba()).map((c) => c.id);
  if (ids.length) {
    const { data: citas } = await servicio
      .from("citas")
      .select("id")
      .in("cliente_id", ids);
    const citaIds = (citas ?? []).map((c) => c.id);
    if (citaIds.length) {
      await servicio.from("avisos_demo").delete().in("cita_id", citaIds);
      await servicio.from("citas").delete().in("id", citaIds);
    }
    await servicio.from("lista_espera").delete().in("cliente_id", ids);
    await servicio.from("clientes").delete().in("id", ids);
  }
  await servicio.from("bloqueos").delete().eq("motivo", APELLIDO);
  await servicio
    .from("avisos_demo")
    .delete()
    .in("tipo", ["codigo", "espera"])
    .in("destino", [...DESTINOS, TEL_ESPERA]);
  await servicio.from("codigos_acceso").delete().in("destino", DESTINOS);
  await servicio.from("accesos_cliente").delete().in("destino", DESTINOS);
}

beforeAll(async () => {
  duena = await clienteComo("duena@salonceiba.test");
  await limpiar();
  const { data } = await anon.rpc("publico_negocio", { p_slug: SLUG });
  const p = data as unknown as {
    servicios: { id: string; duracion: number }[];
    profesionales: { id: string; servicios: string[] }[];
  };
  const suyos = p.profesionales.find((x) => x.id === VALENTINA)!.servicios;
  servicioId = p.servicios.find(
    (s) => suyos.includes(s.id) && s.duracion >= 30 && s.duracion <= 60,
  )!.id;
});

afterAll(limpiar);

describe("Mis citas con código", () => {
  it("el código llega al buzón y abre las citas del cliente por 7 días", async () => {
    expect(await pedir("  Ana.Sanchez1@Ejemplo.test ")).toMatchObject({
      ok: true,
      canal: "correo",
      destino: "an•••@ejemplo.test",
    });
    const codigo = await codigoDe(ANA);
    expect(codigo).toMatch(/^\d{6}$/);
    const otro = codigo === "000000" ? "111111" : "000000";
    expect(await entrar(ANA, otro)).toMatchObject({
      ok: false,
      error: { code: "CODIGO", message: "El código no es correcto" },
    });
    const r = await entrar(ANA, codigo!);
    expect(r.ok).toBe(true);
    expect(r.token).toMatch(/^[0-9a-f]{64}$/);
    // El mismo código no sirve dos veces.
    expect((await entrar(ANA, codigo!)).error?.code).toBe("CODIGO");

    const mis = await misCitas(r.token!);
    expect(mis).toMatchObject({
      cliente: "Ana",
      destino: "an•••@ejemplo.test",
    });
    const tokens = [...mis!.proximas, ...mis!.historial].map((c) => c.token);
    expect(tokens.length).toBeGreaterThan(0);
    const { data: suyas } = await servicio
      .from("citas")
      .select("token, clientes!inner(correo)")
      .in("token", tokens);
    expect(suyas!.every((c) => c.clientes.correo === ANA)).toBe(true);

    await anon.rpc("publico_salir", { p_token: r.token! });
    expect(await misCitas(r.token!)).toBeNull();
    expect(await misCitas("f".repeat(64))).toBeNull();
  });

  it("con el celular llega por WhatsApp", async () => {
    expect(await pedir("300 000 0002")).toMatchObject({
      ok: true,
      canal: "whatsapp",
      destino: "+57 ••• ••• 0002",
    });
    const { data } = await servicio
      .from("avisos_demo")
      .select("canal, destinatario")
      .eq("tipo", "codigo")
      .eq("destino", "+573000000002");
    expect(data).toEqual([
      { canal: "whatsapp", destinatario: "Camila Moreno" },
    ]);
  });

  it("no dice si el dato es de un cliente, y frena los abusos", async () => {
    for (let i = 0; i < 5; i += 1) expect((await pedir(NADIE)).ok).toBe(true);
    expect(await codigoDe(NADIE)).toBeNull();
    expect((await entrar(NADIE, "123456")).error?.code).toBe("CODIGO");
    expect((await pedir(NADIE)).error?.code).toBe("LIMITE");
    expect((await pedir("no es nada")).error?.field).toBe("dato");
  });

  it("cinco intentos fallidos anulan el código", async () => {
    await servicio.from("codigos_acceso").delete().eq("destino", ANA);
    await pedir(ANA);
    const codigo = (await codigoDe(ANA))!;
    const malo = codigo === "999999" ? "888888" : "999999";
    for (let i = 0; i < 4; i += 1) await entrar(ANA, malo);
    expect((await entrar(ANA, malo)).error?.message).toBe(
      "Fallaste 5 veces. Pide un código nuevo",
    );
    expect((await entrar(ANA, codigo)).ok).toBe(false);
  });

  it("nadie lee los códigos ni los accesos directamente", async () => {
    const quien = [anon, duena];
    for (const c of quien) {
      const codigos = await c.from("codigos_acceso").select("id");
      const accesos = await c.from("accesos_cliente").select("token_hash");
      expect(codigos.data ?? []).toEqual([]);
      expect(accesos.data ?? []).toEqual([]);
    }
    expect((await anon.from("lista_espera").select("id")).data ?? []).toEqual(
      [],
    );
    const { error } = await anon.rpc("lista_espera_equipo");
    expect(error).not.toBeNull();
  });
});

describe("lista de espera", () => {
  it("anota una vez, frena en 3 y avisa cuando se libera una hora que cabe", async () => {
    expect((await anotar({ fecha: dia(0) })).ok).toBe(true);
    expect((await anotar({ fecha: dia(0) })).ok).toBe(true);
    expect(await esperasDe(dia(0))).toHaveLength(1);
    expect((await anotar({ fecha: dia(1), franja: "manana" })).ok).toBe(true);
    expect((await anotar({ fecha: dia(2) })).ok).toBe(true);
    expect((await anotar({ fecha: dia(3) })).error?.code).toBe("LIMITE");
    expect(
      (await anotar({ fecha: dia(3), franja: "noche" })).error?.field,
    ).toBe("franja");

    // dia(1): la mañana de Valentina está bloqueada; se libera la tarde → no cabe lo que pidió.
    await servicio.from("bloqueos").insert({
      negocio_id: NEGOCIO_DEMO,
      profesional_id: VALENTINA,
      motivo: APELLIDO,
      inicio: `${dia(1)}T06:00:00`,
      fin: `${dia(1)}T12:00:00`,
    });
    const tarde = await reservarOtro(dia(1), "15:00");
    await anon.rpc("publico_cancelar_cita", { p_token: tarde });
    expect((await esperasDe(dia(1)))[0].estado).toBe("esperando");

    // dia(0): se cancela una cita y hay horas → aviso con el enlace al paso de hora.
    const libre = await reservarOtro(dia(0), "15:00");
    await anon.rpc("publico_cancelar_cita", { p_token: libre });
    expect((await esperasDe(dia(0)))[0].estado).toBe("avisado");
    const { data: avisos } = await servicio
      .from("avisos_demo")
      .select("canal, enlace, cuerpo")
      .eq("tipo", "espera")
      .eq("destino", CORREO_ESPERA);
    expect(avisos).toHaveLength(1);
    expect(avisos![0].enlace).toBe(
      `/reservar/${SLUG}/hora?s=${servicioId}:1&p=${VALENTINA}&f=${dia(0)}`,
    );
    expect(avisos![0].cuerpo).toContain("Hola Prueba, se liberó una hora");
  });

  it("el cliente la ve en Mis citas y se quita; el equipo la ve y la quita", async () => {
    await pedir(CORREO_ESPERA);
    const r = await entrar(CORREO_ESPERA, (await codigoDe(CORREO_ESPERA))!);
    const mis = await misCitas(r.token!);
    expect(mis!.esperas.map((e) => e.estado).sort()).toEqual([
      "avisado",
      "esperando",
      "esperando",
    ]);
    const avisada = mis!.esperas.find((e) => e.estado === "avisado")!;
    const quitar = (token: string) =>
      anon.rpc("publico_quitar_espera", { p_token: token, p_id: avisada.id });
    expect((await quitar(r.token!)).data).toMatchObject({ ok: true });
    expect((await quitar(r.token!)).data).toMatchObject({
      ok: false,
      error: { code: "NO_ENCONTRADA" },
    });
    expect((await quitar("0".repeat(64))).data).toMatchObject({
      ok: false,
      error: { code: "SIN_ACCESO" },
    });

    const { data: filas } = await duena.rpc("lista_espera_equipo");
    const deEllos = (filas ?? []).filter((f) => f.cliente.endsWith(APELLIDO));
    expect(deEllos.map((f) => f.estado).sort()).toEqual([
      "esperando",
      "esperando",
      "quitado",
    ]);
    expect((filas ?? []).length).toBeGreaterThanOrEqual(6);

    const valentina = await clienteComo("valentina@salonceiba.test");
    expect((await valentina.rpc("lista_espera_equipo")).data ?? []).toEqual([]);
    const otra = deEllos.find((f) => f.estado === "esperando")!;
    expect(
      (await valentina.rpc("quitar_de_espera", { p_id: otra.id })).data,
    ).toMatchObject({ ok: false, error: { code: "SIN_PERMISO" } });
    const recepcion = await clienteComo("recepcion@salonceiba.test");
    expect(
      (await recepcion.rpc("quitar_de_espera", { p_id: otra.id })).data,
    ).toMatchObject({ ok: true });
  });
});
