import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  clienteAnonimo,
  clienteComo,
  clienteServicio,
  NEGOCIO_DEMO,
} from "./ayuda";

// Integridad de las citas (0020, T-11.2): nada de dos citas a la misma hora por guardar casi a la vez, ni citas
// canceladas que reviven, ni dos avisos de cancelación. Semanas 21–22, apellido "Integridad INT".
type Cliente = SupabaseClient<Database>;
type Ajustes = Database["public"]["Tables"]["ajustes"]["Update"];
interface Resultado {
  ok: boolean;
  citaIds?: string[];
  token?: string;
  choques?: unknown[];
  error?: { code: string; message: string; field?: string };
}

const SLUG = "salon-ceiba";
const LOCAL = "a1000000-0000-4000-8000-000000000001";
const VALENTINA = "b0000000-0000-4000-8000-000000000003";
const APELLIDO = "Integridad INT";
const CLAVES = [
  "web_dias_max",
  "web_anticipacion_min",
  "permitir_sobrepuestas",
  "permitir_cliente_doble",
  "bloquear_pasadas",
] as const;

const anon = clienteAnonimo();
const servicio = clienteServicio();
let recepcion: Cliente;
let duena: Cliente;
let original: Ajustes;
let servicioId: string;
let duracion: number;
let clientes: string[] = [];
let numero = 0;

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Lunes de dentro de `semanas` semanas (+ n días). */
function lunes(semanas: number, n = 0): string {
  const hoy = new Date();
  return iso(
    new Date(
      hoy.getFullYear(),
      hoy.getMonth(),
      hoy.getDate() - ((hoy.getDay() + 6) % 7) + semanas * 7 + n,
    ),
  );
}

async function ajustar(c: Ajustes) {
  const { error } = await duena
    .from("ajustes")
    .update(c)
    .eq("negocio_id", NEGOCIO_DEMO);
  if (error) throw new Error(error.message);
}

/** Las horas libres de Valentina ese día, según la reserva en línea. */
async function horasLibres(fecha: string): Promise<string[]> {
  const { data, error } = await anon.rpc("publico_disponibilidad", {
    p_slug: SLUG,
    p_servicios: [servicioId],
    p_profesional: VALENTINA,
    p_desde: fecha,
    p_dias: 1,
  });
  if (error) throw new Error(error.message);
  const dias = data as unknown as { fecha: string; horas: string[] }[];
  const horas = dias.find((d) => d.fecha === fecha)?.horas ?? [];
  if (horas.length === 0)
    throw new Error(`Valentina no tiene horas el ${fecha}`);
  return horas;
}

async function guardar(
  c: Cliente,
  p: Record<string, unknown>,
): Promise<Resultado> {
  const { data, error } = await c.rpc("guardar_cita", {
    p: {
      localId: LOCAL,
      servicioId,
      profesionalId: VALENTINA,
      duracionMin: duracion,
      precio: 20000,
      estado: "reservado",
      ...p,
    },
  });
  if (error) throw new Error(error.message);
  return data as unknown as Resultado;
}

async function reservarEnLinea(
  fecha: string,
  hora: string,
): Promise<Resultado> {
  numero += 1;
  const { data, error } = await anon.rpc("publico_reservar", {
    p: {
      slug: SLUG,
      nombre: "Línea",
      apellido: APELLIDO,
      correo: `integridad.linea${numero}@ejemplo.test`,
      telefono: `+57399300${String(numero).padStart(4, "0")}`,
      autoriza: true,
      servicios: [servicioId],
      profesionalId: VALENTINA,
      fecha,
      hora,
    },
  });
  if (error) throw new Error(error.message);
  return data as unknown as Resultado;
}

/** Citas vivas de Valentina ese día a esa hora. */
async function vivas(fecha: string, hora: string) {
  const { data } = await servicio
    .from("citas")
    .select("id")
    .eq("profesional_id", VALENTINA)
    .eq("fecha", fecha)
    .eq("hora_inicio", hora)
    .neq("estado", "cancelado");
  return data ?? [];
}

/** Lista de espera, citas y avisos, en ese orden (borrar citas revisa la lista de espera y avisa). */
async function limpiar() {
  const { data: cl } = await servicio
    .from("clientes")
    .select("id, correo, telefono")
    .eq("negocio_id", NEGOCIO_DEMO)
    .eq("apellido", APELLIDO);
  const ids = (cl ?? []).map((c) => c.id);
  if (ids.length === 0) return;
  await servicio.from("lista_espera").delete().in("cliente_id", ids);
  const { data: citas } = await servicio
    .from("citas")
    .select("id")
    .in("cliente_id", ids);
  const citaIds = (citas ?? []).map((c) => c.id);
  if (citaIds.length) {
    await servicio.from("avisos_demo").delete().in("cita_id", citaIds);
    await servicio.from("citas").delete().in("id", citaIds);
  }
  const destinos = (cl ?? [])
    .flatMap((c) => [c.correo, c.telefono])
    .filter((d): d is string => Boolean(d));
  if (destinos.length)
    await servicio.from("avisos_demo").delete().in("destino", destinos);
  await servicio.from("clientes").delete().in("id", ids);
}

beforeAll(async () => {
  recepcion = await clienteComo("recepcion@salonceiba.test");
  duena = await clienteComo("duena@salonceiba.test");
  await limpiar();
  const { data } = await servicio
    .from("ajustes")
    .select(CLAVES.join(", "))
    .eq("negocio_id", NEGOCIO_DEMO)
    .single();
  original = data as unknown as Ajustes;
  // Las semanas 21–22 quedan dentro de la reserva en línea solo con 180 días.
  await ajustar({
    web_dias_max: 180,
    web_anticipacion_min: 30,
    permitir_sobrepuestas: false,
    permitir_cliente_doble: false,
    bloquear_pasadas: false,
  });
  const { data: portada } = await anon.rpc("publico_negocio", {
    p_slug: SLUG,
  });
  const p = portada as unknown as {
    servicios: { id: string; duracion: number }[];
    profesionales: { id: string; servicios: string[] }[];
  };
  const suyos = p.profesionales.find((x) => x.id === VALENTINA)!.servicios;
  const elegido = p.servicios.find(
    (s) => suyos.includes(s.id) && s.duracion >= 30 && s.duracion <= 60,
  )!;
  servicioId = elegido.id;
  duracion = elegido.duracion;
  const { data: nuevos, error } = await servicio
    .from("clientes")
    .insert(
      [1, 2].map((n) => ({
        negocio_id: NEGOCIO_DEMO,
        nombre: `Cliente ${n}`,
        apellido: APELLIDO,
        correo: `integridad${n}@ejemplo.test`,
        telefono: `+5739920000${n}`,
      })),
    )
    .select("id");
  if (error) throw new Error(error.message);
  clientes = (nuevos ?? []).map((c) => c.id);
});

afterAll(async () => {
  await limpiar();
  if (original) await ajustar(original);
});

describe("guardar casi a la vez", () => {
  it("cuatro guardar_cita a la misma hora en paralelo dejan una sola cita", async () => {
    const fecha = lunes(21);
    const [hora] = await horasLibres(fecha);
    const intentos = await Promise.all(
      [recepcion, duena, recepcion, duena].map((c, i) =>
        guardar(c, {
          clienteId: clientes[i % 2],
          fecha,
          horaInicio: hora,
        }),
      ),
    );
    expect(intentos.filter((r) => r.ok)).toHaveLength(1);
    expect(await vivas(fecha, `${hora}:00`)).toHaveLength(1);
  });

  it("una de la reserva en línea y otra de la agenda a la vez dejan una sola cita", async () => {
    const fecha = lunes(21, 7);
    const [hora] = await horasLibres(fecha);
    const [linea, agenda] = await Promise.all([
      reservarEnLinea(fecha, hora),
      guardar(recepcion, { clienteId: clientes[0], fecha, horaInicio: hora }),
    ]);
    expect([linea.ok, agenda.ok].filter(Boolean)).toHaveLength(1);
    expect(await vivas(fecha, `${hora}:00`)).toHaveLength(1);
  });
});

describe("cancelar", () => {
  async function citaNueva(n: number) {
    const fecha = lunes(22, n);
    const [hora] = await horasLibres(fecha);
    const r = await guardar(recepcion, {
      clienteId: clientes[1],
      fecha,
      horaInicio: hora,
    });
    expect(r.ok).toBe(true);
    return r.citaIds![0];
  }

  async function cancelar(id: string): Promise<Resultado> {
    const { data, error } = await recepcion.rpc("cancelar_cita", {
      p_cita: id,
      p_alcance: "solo_esta",
    });
    if (error) throw new Error(error.message);
    return data as unknown as Resultado;
  }

  it("una cita cancelada no cambia de estado (CANCELADA)", async () => {
    const id = await citaNueva(0);
    expect((await cancelar(id)).ok).toBe(true);
    const { data, error } = await recepcion.rpc("cambiar_estado_cita", {
      p_cita: id,
      p_estado: "confirmado",
    });
    expect(error).toBeNull();
    expect((data as unknown as Resultado).error?.code).toBe("CANCELADA");
    const { data: cita } = await servicio
      .from("citas")
      .select("estado")
      .eq("id", id)
      .single();
    expect(cita?.estado).toBe("cancelado");
  });

  it("cancelar dos veces deja un solo aviso de cancelación", async () => {
    const id = await citaNueva(1);
    const avisos = async () => {
      const { count } = await servicio
        .from("avisos_demo")
        .select("id", { count: "exact", head: true })
        .eq("cita_id", id)
        .eq("tipo", "cancelacion");
      return count ?? 0;
    };
    expect((await cancelar(id)).ok).toBe(true);
    const primera = await avisos();
    expect(primera).toBeGreaterThan(0);
    const otra = await cancelar(id);
    expect(otra.ok).toBe(true);
    expect(otra.citaIds).toEqual([]);
    expect(await avisos()).toBe(primera);
  });
});

describe("citas pasadas bloqueadas", () => {
  it("una cita de adelante no se pasa a un día pasado", async () => {
    const fecha = lunes(22, 2);
    const [hora] = await horasLibres(fecha);
    const r = await guardar(recepcion, {
      clienteId: clientes[0],
      fecha,
      horaInicio: hora,
    });
    expect(r.ok).toBe(true);
    await ajustar({ bloquear_pasadas: true });
    try {
      const ayer = new Date();
      ayer.setDate(ayer.getDate() - 2);
      const movida = await guardar(recepcion, {
        id: r.citaIds![0],
        clienteId: clientes[0],
        fecha: iso(ayer),
        horaInicio: hora,
        forzar: true,
      });
      expect(movida.ok).toBe(false);
      expect(movida.error?.code).toBe("CITA_PASADA");
      expect(movida.error?.field).toBe("fecha");
    } finally {
      await ajustar({ bloquear_pasadas: false });
    }
  });

  it("sin sesión no se llama guardar_cita", async () => {
    const { error } = await anon.rpc("guardar_cita", { p: {} });
    expect(error).not.toBeNull();
  });
});
