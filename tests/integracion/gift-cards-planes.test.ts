import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  clienteAnonimo,
  clienteComo,
  clienteServicio,
  NEGOCIO_DEMO,
} from "./ayuda";

// Gift cards y planes (0009): vender, canjear, anular y usar un plan en una cita. Crea sus propias citas, ventas y
// un plan de prueba ("Plan E2E prueba") en un día lejano, y al final borra todo y deja la numeración como estaba.
type Cliente = SupabaseClient<Database>;
interface Resultado {
  ok: boolean;
  ventaId?: string;
  estado?: string;
  giftCards?: { codigo: string; saldo: number; vence: string }[];
  error?: { code: string; message: string; field?: string };
}

const LOCAL = "a1000000-0000-4000-8000-000000000001";
const CAROLINA = "b0000000-0000-4000-8000-000000000001";

let servicio: Cliente;
let recepcion: Cliente;
let duena: Cliente;
let siguienteOriginal: number;
let servicioId: string;
let otroServicio: { id: string; precio: number };
let clienteId: string;
let transferencia: string;
let giftCardMetodo: string;
let modelo: { id: string; precio: number; monto: number };
let planId: string;
const citas: string[] = [];
const ventas: string[] = [];

/** Un día de dentro de 9 semanas (lejos de la semilla y de las otras pruebas). */
function diaPrueba(): string {
  const d = new Date();
  // Al mediodía: la fecha en UTC (toISOString) es la del día local también de noche, cuando en UTC ya es mañana.
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 63);
  return d.toISOString().slice(0, 10);
}

async function nuevaCita(precio = 45000): Promise<string> {
  const minutos = 6 * 60 + citas.length * 30;
  const hora = `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
  const { data, error } = await servicio
    .from("citas")
    .insert({
      negocio_id: NEGOCIO_DEMO,
      local_id: LOCAL,
      cliente_id: clienteId,
      profesional_id: CAROLINA,
      servicio_id: servicioId,
      fecha: diaPrueba(),
      hora_inicio: hora,
      hora_fin: hora,
      duracion_min: 30,
      precio,
      estado: "asiste",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "sin cita");
  citas.push(data.id);
  return data.id;
}

const base = {
  servicioId: null,
  productoId: null,
  planId: null,
  giftCardModeloId: null,
  citaId: null,
};
const itemCita = (citaId: string, precio = 45000) => ({
  ...base,
  citaId,
  servicioId,
  profesionalId: CAROLINA,
  descripcion: "",
  cantidad: 1,
  precioUnitario: precio,
});
const itemGiftCard = () => ({
  ...base,
  giftCardModeloId: modelo.id,
  profesionalId: null,
  descripcion: "Gift card",
  cantidad: 1,
  precioUnitario: modelo.precio,
});
const itemPlan = () => ({
  ...base,
  planId,
  profesionalId: null,
  descripcion: "Plan E2E prueba",
  cantidad: 1,
  precioUnitario: 30000,
});

async function cerrar(
  c: Cliente,
  p: Record<string, unknown>,
): Promise<Resultado> {
  const { data, error } = await c.rpc("cerrar_venta", {
    p: { localId: LOCAL, clienteId, descuento: 0, pagos: [], ...p },
  });
  if (error) throw new Error(error.message);
  const r = data as unknown as Resultado;
  if (r.ok && r.ventaId) ventas.push(r.ventaId);
  return r;
}

async function anular(ventaId: string): Promise<Resultado> {
  const { data, error } = await duena.rpc("anular_venta", {
    p_venta: ventaId,
    p_motivo: "Prueba",
  });
  if (error) throw new Error(error.message);
  return data as unknown as Resultado;
}

async function rpcBono(
  c: Cliente,
  cita: string,
  bono?: string,
): Promise<Resultado> {
  const { data, error } = bono
    ? await c.rpc("usar_bono", { p_cita: cita, p_bono: bono })
    : await c.rpc("soltar_bono", { p_cita: cita });
  if (error) throw new Error(error.message);
  return data as unknown as Resultado;
}

async function cita(id: string) {
  const { data } = await servicio
    .from("citas")
    .select("precio, bono_id, servicio_id")
    .eq("id", id)
    .single();
  return data!;
}

beforeAll(async () => {
  servicio = clienteServicio();
  recepcion = await clienteComo("recepcion@salonceiba.test");
  duena = await clienteComo("duena@salonceiba.test");
  const { data: a } = await servicio
    .from("ajustes")
    .select("venta_siguiente")
    .eq("negocio_id", NEGOCIO_DEMO)
    .single();
  siguienteOriginal = a!.venta_siguiente;
  const { data: s } = await recepcion
    .from("servicios")
    .select("id, precio")
    .eq("activo", true)
    .eq("tipo", "servicio")
    .order("nombre")
    .limit(2);
  servicioId = s![0].id;
  otroServicio = s![1];
  const { data: cl } = await recepcion
    .from("clientes")
    .select("id")
    .order("apellido")
    .limit(1)
    .single();
  clienteId = cl!.id;
  const { data: m } = await recepcion.from("metodos_pago").select("id, tipo");
  transferencia = m!.find((x) => x.tipo === "transferencia")!.id;
  giftCardMetodo = m!.find((x) => x.tipo === "gift_card")!.id;
  const { data: g } = await recepcion
    .from("gift_card_modelos")
    .select("id, precio, monto")
    .eq("activo", true)
    .order("monto")
    .limit(1)
    .single();
  modelo = g!;
  const { data: p, error } = await servicio
    .from("planes")
    .insert({
      negocio_id: NEGOCIO_DEMO,
      nombre: "Plan E2E prueba",
      precio: 30000,
      vigencia_dias: 120,
      sesiones: 1,
      servicios: [servicioId],
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  planId = p!.id;
});

afterAll(async () => {
  if (citas.length) await servicio.from("citas").delete().in("id", citas);
  // De la última a la primera: las ventas pagadas con la gift card van antes que la venta que la creó.
  for (const id of [...ventas].reverse())
    await servicio.from("ventas").delete().eq("id", id);
  await servicio.from("planes").delete().eq("id", planId);
  await servicio
    .from("ajustes")
    .update({ venta_siguiente: siguienteOriginal })
    .eq("negocio_id", NEGOCIO_DEMO);
});

describe("gift cards y planes sin sesión", () => {
  it("el público no ve ni usa gift cards, planes ni bonos", async () => {
    const anon = clienteAnonimo();
    for (const tabla of [
      "gift_cards",
      "gift_card_modelos",
      "planes",
      "bonos",
    ] as const) {
      const { data } = await anon.from(tabla).select("id").limit(1);
      expect(data ?? []).toEqual([]);
    }
    const { error } = await anon.rpc("listar_bonos", {});
    expect(error).not.toBeNull();
    const usar = await anon.rpc("usar_bono", {
      p_cita: citas[0] ?? NEGOCIO_DEMO,
      p_bono: NEGOCIO_DEMO,
    });
    expect(usar.error).not.toBeNull();
  });
});

describe("gift cards", () => {
  let codigo: string;
  let ventaTarjeta: string;
  let ventaCanje: string;

  it("vender una gift card da un código con su saldo", async () => {
    const r = await cerrar(recepcion, {
      items: [itemGiftCard()],
      pagos: [{ metodoId: transferencia, monto: modelo.precio }],
    });
    expect(r).toMatchObject({ ok: true, estado: "pagada" });
    expect(r.giftCards).toHaveLength(1);
    codigo = r.giftCards![0].codigo;
    expect(codigo).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(r.giftCards![0].saldo).toBe(modelo.monto);
    ventaTarjeta = r.ventaId!;
  });

  it("pagar con el código descuenta el saldo y no mueve la caja", async () => {
    const id = await nuevaCita(modelo.monto - 5000);
    const r = await cerrar(recepcion, {
      items: [itemCita(id, modelo.monto - 5000)],
      pagos: [
        {
          metodoId: giftCardMetodo,
          monto: modelo.monto - 5000,
          giftCard: codigo.toLowerCase(),
        },
      ],
    });
    expect(r).toMatchObject({ ok: true, estado: "pagada" });
    ventaCanje = r.ventaId!;
    const { data: card } = await servicio
      .from("gift_cards")
      .select("saldo")
      .eq("codigo", codigo)
      .single();
    expect(card!.saldo).toBe(5000);
    const { data: caja } = await servicio
      .from("movimientos_caja")
      .select("id")
      .eq("venta_id", ventaCanje);
    expect(caja).toEqual([]);
    const { data: pago } = await servicio
      .from("pagos")
      .select("comprobante, gift_card_id")
      .eq("venta_id", ventaCanje)
      .single();
    expect(pago!.comprobante).toBe(codigo);
    expect(pago!.gift_card_id).not.toBeNull();
  });

  it("sin saldo, con un código que no existe o vencida, no se acepta", async () => {
    const id = await nuevaCita();
    const pagar = (giftCard: string) =>
      cerrar(recepcion, {
        items: [itemCita(id)],
        pagos: [{ metodoId: giftCardMetodo, monto: 45000, giftCard }],
      });
    const corto = await pagar(codigo);
    expect(corto.error).toMatchObject({ code: "GIFT_CARD", field: "giftCard" });
    expect(corto.error!.message).toMatch(/^A esa gift card le quedan/);
    expect((await pagar("ZZZZ-ZZZZ")).error!.message).toBe(
      "No encontramos una gift card con ese código",
    );
    await servicio
      .from("gift_cards")
      .update({ vence: "2020-01-01" })
      .eq("codigo", codigo);
    const vencida = await cerrar(recepcion, {
      items: [itemCita(id, 5000)],
      pagos: [{ metodoId: giftCardMetodo, monto: 5000, giftCard: codigo }],
    });
    expect(vencida.error!.message).toMatch(/^Esa gift card venció el/);
    await servicio
      .from("gift_cards")
      .update({ vence: "2099-12-31" })
      .eq("codigo", codigo);
  });

  it("no se anula una gift card usada; anular el canje le devuelve el saldo", async () => {
    expect((await anular(ventaTarjeta)).error?.code).toBe("GIFT_CARD_USADA");
    expect((await anular(ventaCanje)).ok).toBe(true);
    const { data: card } = await servicio
      .from("gift_cards")
      .select("saldo")
      .eq("codigo", codigo)
      .single();
    expect(card!.saldo).toBe(modelo.monto);
    expect((await anular(ventaTarjeta)).ok).toBe(true);
    const { data: anulada } = await servicio
      .from("gift_cards")
      .select("anulada")
      .eq("codigo", codigo)
      .single();
    expect(anulada!.anulada).toBe(true);
  });
});

describe("planes", () => {
  let bonoId: string;
  let ventaPlan: string;
  let primera: string;
  let segunda: string;

  it("un plan necesita cliente y queda a su nombre con su cupo", async () => {
    const sinCliente = await cerrar(recepcion, {
      clienteId: null,
      items: [itemPlan()],
      pagos: [{ metodoId: transferencia, monto: 30000 }],
    });
    expect(sinCliente.error?.message).toBe(
      "Elige el cliente: los planes, sesiones y paquetes quedan a su nombre",
    );
    const r = await cerrar(recepcion, {
      items: [itemPlan()],
      pagos: [{ metodoId: transferencia, monto: 30000 }],
    });
    expect(r.ok).toBe(true);
    ventaPlan = r.ventaId!;
    const { data } = await recepcion.rpc("listar_bonos", {
      p_cliente: clienteId,
    });
    const bono = data!.find((b) => b.nombre === "Plan E2E prueba")!;
    expect(bono).toMatchObject({ tipo: "plan", cupo: 1, usadas: 0 });
    bonoId = bono.id;
  });

  it("usar el plan deja la cita en $0 y respeta el cupo; quitarlo lo libera", async () => {
    primera = await nuevaCita();
    segunda = await nuevaCita();
    expect((await rpcBono(recepcion, primera, bonoId)).ok).toBe(true);
    expect(await cita(primera)).toMatchObject({ precio: 0, bono_id: bonoId });
    const lleno = await rpcBono(recepcion, segunda, bonoId);
    expect(lleno.error).toMatchObject({
      code: "NO_SIRVE",
      message: "El plan ya usó sus 1 citas",
    });
    expect((await rpcBono(recepcion, primera)).ok).toBe(true);
    expect(await cita(primera)).toMatchObject({
      bono_id: null,
      precio: expect.any(Number),
    });
    expect((await cita(primera)).precio).toBeGreaterThan(0);
    expect((await rpcBono(recepcion, segunda, bonoId)).ok).toBe(true);
  });

  it("un profesional no puede usar planes", async () => {
    const carolina = await clienteComo("carolina@salonceiba.test");
    expect((await rpcBono(carolina, primera, bonoId)).error?.code).toBe(
      "SIN_PERMISO",
    );
  });

  it("si la cita cambia a un servicio que el plan no cubre, sale del plan", async () => {
    await servicio.from("citas").update({ precio: 99999 }).eq("id", segunda);
    expect(await cita(segunda)).toMatchObject({ precio: 0, bono_id: bonoId });
    await servicio
      .from("citas")
      .update({ servicio_id: otroServicio.id })
      .eq("id", segunda);
    expect(await cita(segunda)).toMatchObject({
      bono_id: null,
      precio: otroServicio.precio,
    });
    await servicio
      .from("citas")
      .update({ servicio_id: servicioId })
      .eq("id", segunda);
  });

  it("la cita con plan se cobra en $0 y el plan en uso no se anula", async () => {
    expect((await rpcBono(recepcion, primera, bonoId)).ok).toBe(true);
    const r = await cerrar(recepcion, { items: [itemCita(primera, 0)] });
    expect(r).toMatchObject({ ok: true, estado: "pagada" });
    expect((await rpcBono(recepcion, primera)).error?.code).toBe("YA_COBRADA");
    expect((await anular(ventaPlan)).error?.code).toBe("PLAN_EN_USO");
  });
});
