import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ahoraEnZona } from "@/features/agenda/lib/fechas";
import {
  clienteAnonimo,
  clienteComo,
  clienteServicio,
  NEGOCIO_DEMO,
} from "./ayuda";

// Reportes, productos (lectura y permisos) y búsqueda rápida de hora contra Supabase local. Los reportes se
// comparan en la semana pasada: ninguna prueba crea citas ni ventas ahí mientras esta corre.
type Cliente = SupabaseClient<Database>;
interface Reservas {
  total: number;
  activas: number;
  porEstado: Record<string, number>;
  porDia: {
    dia: number;
    minutosReservados: number;
    minutosDisponibles: number;
  }[];
  porFecha: { fecha: string; reservas: number }[];
  minutosReservados: number;
  minutosDisponibles: number;
}
interface Ventas {
  total: number;
  cantidad: number;
  porTipo: { servicios: number; productos: number; otros: number };
  categorias: { nombre: string; total: number }[];
}
interface Horas {
  ok: boolean;
  horas?: { fecha: string; hora: string; profesionalId: string }[];
  aviso?: string;
  error?: { code: string };
}

const LOCAL = "a1000000-0000-4000-8000-000000000001";
const VALENTINA = "b0000000-0000-4000-8000-000000000003";

let servicio: Cliente;
let duena: Cliente;
let recepcion: Cliente;
let desde: string;
let hasta: string;

beforeAll(async () => {
  servicio = clienteServicio();
  duena = await clienteComo("duena@salonceiba.test");
  recepcion = await clienteComo("recepcion@salonceiba.test");
  const lunes = addDays(
    startOfWeek(parseISO(ahoraEnZona().fecha), { weekStartsOn: 1 }),
    -7,
  );
  desde = format(lunes, "yyyy-MM-dd");
  hasta = format(addDays(lunes, 6), "yyyy-MM-dd");
});

describe("reportes", () => {
  it("sin sesión no hay reportes", async () => {
    const { error } = await clienteAnonimo().rpc("estadisticas_reservas", {
      p_desde: desde,
      p_hasta: hasta,
    });
    expect(error).not.toBeNull();
  });

  it("las reservas cuadran con las citas de la semana", async () => {
    const { data } = await recepcion.rpc("estadisticas_reservas", {
      p_desde: desde,
      p_hasta: hasta,
    });
    const r = data as unknown as Reservas;
    const { count } = await servicio
      .from("citas")
      .select("id", { count: "exact", head: true })
      .eq("negocio_id", NEGOCIO_DEMO)
      .gte("fecha", desde)
      .lte("fecha", hasta);
    expect(r.total).toBe(count);
    expect(r.total).toBeGreaterThan(0);
    expect(Object.values(r.porEstado).reduce((a, b) => a + b, 0)).toBe(r.total);
    expect(r.activas).toBe(r.total - (r.porEstado.cancelado ?? 0));
    expect(r.porDia).toHaveLength(7);
    expect(r.porFecha.map((f) => f.fecha)).toEqual(
      [0, 1, 2, 3, 4, 5, 6].map((i) =>
        format(addDays(parseISO(desde), i), "yyyy-MM-dd"),
      ),
    );
    expect(r.porFecha.reduce((a, f) => a + f.reservas, 0)).toBe(r.activas);
    expect(r.minutosDisponibles).toBeGreaterThan(r.minutosReservados);
    // El domingo el salón no abre: sin minutos disponibles.
    expect(r.porDia[6].minutosDisponibles).toBe(0);
  });

  it("las ventas cuadran con las ventas no anuladas de la semana", async () => {
    const { data } = await duena.rpc("estadisticas_ventas", {
      p_desde: desde,
      p_hasta: hasta,
    });
    const v = data as unknown as Ventas;
    const { data: filas } = await servicio
      .from("ventas")
      .select("total, subtotal")
      .eq("negocio_id", NEGOCIO_DEMO)
      .neq("estado", "anulada")
      .gte("created_at", `${desde}T00:00:00-05:00`)
      .lt(
        "created_at",
        `${format(addDays(parseISO(hasta), 1), "yyyy-MM-dd")}T00:00:00-05:00`,
      );
    expect(v.cantidad).toBe(filas!.length);
    expect(v.total).toBe(filas!.reduce((a, f) => a + f.total, 0));
    const subtotal = filas!.reduce((a, f) => a + f.subtotal, 0);
    expect(v.porTipo.servicios + v.porTipo.productos + v.porTipo.otros).toBe(
      subtotal,
    );
    expect(v.categorias.reduce((a, c) => a + c.total, 0)).toBe(subtotal);
  });
});

describe("productos: quién los ve y quién los crea", () => {
  it("recepción los ve para venderlos pero no los crea; sin sesión no se ven", async () => {
    const { data } = await recepcion.from("productos").select("id");
    expect(data!.length).toBeGreaterThanOrEqual(8);
    const crear = await recepcion
      .from("productos")
      .insert({
        negocio_id: NEGOCIO_DEMO,
        nombre: "No debería existir",
        precio: 1000,
      });
    expect(crear.error).not.toBeNull();
    const anonimo = await clienteAnonimo().from("productos").select("id");
    expect(anonimo.error ?? anonimo.data).toBeTruthy();
    expect(anonimo.data ?? []).toHaveLength(0);
  });

  it("nadie crea un producto con existencias inventadas", async () => {
    const { error } = await duena.from("productos").insert({
      negocio_id: NEGOCIO_DEMO,
      nombre: "Producto con existencias directas",
      precio: 1000,
      existencias: 99,
    });
    expect(error).not.toBeNull();
  });
});

describe("búsqueda rápida de hora", () => {
  async function servicioId(nombre: string) {
    const { data } = await recepcion
      .from("servicios")
      .select("id")
      .eq("nombre", nombre)
      .single();
    return data!.id;
  }

  it("da las primeras horas libres en orden, desde hoy", async () => {
    const { data } = await recepcion.rpc("buscar_horas_libres", {
      p_local: LOCAL,
      p_servicio: await servicioId("Corte y barba"),
      p_desde: ahoraEnZona().fecha,
      p_cantidad: 6,
    });
    const r = data as unknown as Horas;
    expect(r.ok).toBe(true);
    expect(r.horas!.length).toBe(6);
    const claves = r.horas!.map((h) => `${h.fecha} ${h.hora}`);
    expect([...claves].sort()).toEqual(claves);
    expect(new Set(claves).size).toBe(6);
    expect(r.horas!.every((h) => h.fecha >= ahoraEnZona().fecha)).toBe(true);
  });

  it("avisa si el profesional no hace el servicio; un profesional no busca", async () => {
    const { data } = await recepcion.rpc("buscar_horas_libres", {
      p_local: LOCAL,
      p_servicio: await servicioId("Corte y barba"),
      p_profesional: VALENTINA,
      p_desde: ahoraEnZona().fecha,
    });
    expect(data).toMatchObject({
      ok: true,
      horas: [],
      aviso: "Ese profesional no hace ese servicio",
    });
    const valentina = await clienteComo("valentina@salonceiba.test");
    const { data: sin } = await valentina.rpc("buscar_horas_libres", {
      p_local: LOCAL,
      p_servicio: await servicioId("Corte y barba"),
      p_desde: ahoraEnZona().fecha,
    });
    expect((sin as unknown as Horas).error?.code).toBe("SIN_PERMISO");
  });
});
