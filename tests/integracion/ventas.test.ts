import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ahoraEnZona } from "@/features/agenda/lib/fechas";
import {
  clienteAnonimo,
  clienteComo,
  clienteServicio,
  NEGOCIO_DEMO,
} from "./ayuda";

// Ventas, pagos, caja y numeración en la base (cerrar_venta, pagar_saldo, anular_venta, …) contra Supabase local.
type Cliente = SupabaseClient<Database>;
interface Resultado {
  ok: boolean;
  ventaId?: string;
  numero?: string;
  vuelto?: number;
  estado?: string;
  pagado?: number;
  diferencia?: number;
  error?: { code: string; message: string; field?: string };
}

const LOCAL = "a1000000-0000-4000-8000-000000000001";
const CAROLINA = "b0000000-0000-4000-8000-000000000001";

let servicio: Cliente;
let recepcion: Cliente;
let duena: Cliente;
let siguienteOriginal: number;
let servicioId: string;
let clienteId: string;
let efectivo: string;
let transferencia: string;
const citas: string[] = [];
const ventas: string[] = [];
const movimientos: string[] = [];

/** Un día de dentro de 8 semanas (lejos de la semilla y de las otras pruebas). */
function diaPrueba(): string {
  const d = new Date();
  // Al mediodía: la fecha en UTC (toISOString) es la del día local también de noche, cuando en UTC ya es mañana.
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 56);
  return d.toISOString().slice(0, 10);
}

/** Cita de apoyo creada directo en la base (las reglas de la agenda no son lo que se prueba aquí). */
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

function item(citaId: string, precio = 45000) {
  return {
    citaId,
    servicioId,
    profesionalId: CAROLINA,
    descripcion: "",
    cantidad: 1,
    precioUnitario: precio,
  };
}

async function cerrar(
  c: Cliente,
  p: Record<string, unknown>,
): Promise<Resultado> {
  const { data, error } = await c.rpc("cerrar_venta", {
    p: { localId: LOCAL, descuento: 0, pagos: [], ...p },
  });
  if (error) throw new Error(error.message);
  const r = data as unknown as Resultado;
  if (r.ok && r.ventaId) ventas.push(r.ventaId);
  return r;
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
    .select("id")
    .eq("activo", true)
    .limit(1)
    .single();
  servicioId = s!.id;
  const { data: cl } = await recepcion
    .from("clientes")
    .select("id")
    .order("apellido")
    .limit(1)
    .single();
  clienteId = cl!.id;
  const { data: m } = await recepcion.from("metodos_pago").select("id, tipo");
  efectivo = m!.find((x) => x.tipo === "efectivo")!.id;
  transferencia = m!.find((x) => x.tipo === "transferencia")!.id;
});

afterAll(async () => {
  if (ventas.length) await servicio.from("ventas").delete().in("id", ventas);
  if (movimientos.length)
    await servicio.from("movimientos_caja").delete().in("id", movimientos);
  if (citas.length) await servicio.from("citas").delete().in("id", citas);
  await servicio
    .from("numeracion_cambios")
    .delete()
    .eq("negocio_id", NEGOCIO_DEMO);
  // Deja la numeración como estaba: las ventas de prueba se borraron, así que no quedan huecos.
  await servicio
    .from("ajustes")
    .update({
      venta_siguiente: siguienteOriginal,
      venta_prefijo: "",
      caja_cliente_obligatorio: false,
    })
    .eq("negocio_id", NEGOCIO_DEMO);
});

describe("numeración y cobro de citas", () => {
  it("dos pestañas cobrando a la vez reciben números seguidos, sin saltos ni repetidos", async () => {
    const ids = await Promise.all([1, 2, 3, 4, 5, 6].map(() => nuevaCita()));
    const resultados = await Promise.all(
      ids.map((id, i) =>
        cerrar(i % 2 ? recepcion : duena, {
          items: [item(id)],
          pagos: [{ metodoId: transferencia, monto: 45000 }],
        }),
      ),
    );
    expect(resultados.every((r) => r.ok)).toBe(true);
    const numeros = resultados
      .map((r) => Number(r.numero))
      .sort((a, b) => a - b);
    expect(new Set(numeros).size).toBe(6);
    expect(numeros[5] - numeros[0]).toBe(5);
  });

  it("una cita cobrada no se vuelve a cobrar, ni desde dos pestañas a la vez", async () => {
    const id = await nuevaCita();
    const [a, b] = await Promise.all([
      cerrar(recepcion, {
        items: [item(id)],
        pagos: [{ metodoId: transferencia, monto: 45000 }],
      }),
      cerrar(duena, {
        items: [item(id)],
        pagos: [{ metodoId: transferencia, monto: 45000 }],
      }),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    const otra = await cerrar(recepcion, {
      items: [item(id)],
      pagos: [{ metodoId: transferencia, monto: 45000 }],
    });
    expect(otra.ok).toBe(false);
    expect(otra.error?.code).toBe("YA_COBRADA");
    expect(otra.error?.message).toMatch(
      /^Esta cita ya se cobró \(venta \d+\)$/,
    );
  });

  it("efectivo calcula el vuelto y avisa si lo recibido no alcanza", async () => {
    const id = await nuevaCita();
    const corto = await cerrar(recepcion, {
      items: [item(id)],
      pagos: [{ metodoId: efectivo, monto: 45000, recibido: 40000 }],
    });
    expect(corto.error?.message).toBe("El monto recibido no alcanza");
    const r = await cerrar(recepcion, {
      items: [item(id)],
      pagos: [{ metodoId: efectivo, monto: 45000, recibido: 50000 }],
    });
    expect(r).toMatchObject({ ok: true, vuelto: 5000, estado: "pagada" });
    const { data: caja } = await duena
      .from("movimientos_caja")
      .select("monto, efectivo")
      .eq("venta_id", r.ventaId!);
    expect(caja).toEqual([{ monto: 45000, efectivo: true }]);
  });

  it("pagos de más no se aceptan; varios métodos completan el total", async () => {
    const id = await nuevaCita(60000);
    const demas = await cerrar(recepcion, {
      items: [item(id, 60000)],
      pagos: [{ metodoId: transferencia, monto: 70000 }],
    });
    expect(demas.error?.message).toBe("Los pagos superan el total");
    const r = await cerrar(recepcion, {
      items: [item(id, 60000)],
      descuento: 10000,
      pagos: [
        { metodoId: transferencia, monto: 30000 },
        { metodoId: efectivo, monto: 20000, recibido: 20000 },
      ],
    });
    expect(r).toMatchObject({ ok: true, estado: "pagada", pagado: 50000 });
  });

  it("un abono deja la venta en pago parcial, sale en Mis cobros y el saldo completa la misma venta", async () => {
    const id = await nuevaCita(40000);
    const r = await cerrar(recepcion, {
      items: [item(id, 40000)],
      pagos: [{ metodoId: transferencia, monto: 15000 }],
    });
    expect(r).toMatchObject({ ok: true, estado: "parcial", pagado: 15000 });
    const dia = diaPrueba();
    const hoy = ahoraEnZona().fecha;
    const { data: pendientes } = await recepcion.rpc("cobros_pendientes", {
      p_desde: hoy,
      p_hasta: dia,
    });
    expect(pendientes?.find((p) => p.venta_id === r.ventaId)).toMatchObject({
      tipo: "saldo",
      monto: 25000,
    });

    const { data: saldo } = await recepcion.rpc("pagar_saldo", {
      p: {
        ventaId: r.ventaId,
        pagos: [{ metodoId: efectivo, monto: 25000, recibido: 30000 }],
      },
    });
    expect(saldo).toMatchObject({
      ok: true,
      ventaId: r.ventaId,
      estado: "pagada",
      vuelto: 5000,
      pagado: 40000,
    });
    const { data: otra } = await recepcion.rpc("pagar_saldo", {
      p: { ventaId: r.ventaId, pagos: [{ metodoId: efectivo, monto: 1000 }] },
    });
    expect((otra as unknown as Resultado).error?.message).toBe(
      "Esta venta ya está pagada",
    );
  });

  it("con cliente obligatorio no se cierra una venta sin cliente", async () => {
    await servicio
      .from("ajustes")
      .update({ caja_cliente_obligatorio: true })
      .eq("negocio_id", NEGOCIO_DEMO);
    const r = await cerrar(recepcion, {
      items: [
        { servicioId, descripcion: "", cantidad: 1, precioUnitario: 20000 },
      ],
      pagos: [{ metodoId: transferencia, monto: 20000 }],
    });
    expect(r.error).toMatchObject({
      message: "Elige el cliente de esta venta",
      field: "clienteId",
    });
    await servicio
      .from("ajustes")
      .update({ caja_cliente_obligatorio: false })
      .eq("negocio_id", NEGOCIO_DEMO);
  });
});

describe("anular, comprobante y agenda", () => {
  it("anular revierte la caja y libera la cita para cobrarla otra vez", async () => {
    const id = await nuevaCita();
    const r = await cerrar(recepcion, {
      items: [item(id)],
      pagos: [{ metodoId: efectivo, monto: 45000 }],
    });
    const { data: sinPermiso } = await recepcion.rpc("anular_venta", {
      p_venta: r.ventaId!,
      p_motivo: "Prueba",
    });
    expect((sinPermiso as unknown as Resultado).error?.code).toBe(
      "SIN_PERMISO",
    );

    const { data: anulada } = await duena.rpc("anular_venta", {
      p_venta: r.ventaId!,
      p_motivo: "Cobro de prueba",
    });
    expect((anulada as unknown as Resultado).ok).toBe(true);
    const { data: caja } = await duena
      .from("movimientos_caja")
      .select("tipo, monto")
      .eq("venta_id", r.ventaId!);
    expect(caja?.map((m) => m.monto).sort((a, b) => a - b)).toEqual([
      -45000, 45000,
    ]);
    const otra = await cerrar(recepcion, {
      items: [item(id)],
      pagos: [{ metodoId: transferencia, monto: 45000 }],
    });
    expect(otra.ok).toBe(true);
  });

  it("la agenda marca la cita cobrada y el comprobante llega al buzón", async () => {
    const id = await nuevaCita();
    const r = await cerrar(recepcion, {
      items: [item(id)],
      pagos: [{ metodoId: transferencia, monto: 45000 }],
    });
    const dia = diaPrueba();
    const { data: agenda } = await recepcion.rpc("agenda_citas", {
      p_local: LOCAL,
      p_desde: dia,
      p_hasta: dia,
    });
    expect(agenda?.find((c) => c.id === id)?.venta_estado).toBe("pagada");
    const { data: envio } = await recepcion.rpc("enviar_comprobante", {
      p_venta: r.ventaId!,
    });
    expect((envio as unknown as Resultado).ok).toBe(true);
    const { data: avisos } = await recepcion
      .from("avisos_demo")
      .select("canal, tipo")
      .eq("venta_id", r.ventaId!);
    expect(avisos?.map((a) => a.canal).sort()).toEqual(["correo", "whatsapp"]);
  });

  it("la propina va aparte del total y de la caja, y en efectivo sale del vuelto (0019)", async () => {
    const id = await nuevaCita();
    const corto = await cerrar(recepcion, {
      items: [item(id)],
      pagos: [
        { metodoId: efectivo, monto: 45000, recibido: 48000, propina: 5000 },
      ],
    });
    expect(corto.error?.message).toBe("El monto recibido no alcanza");
    const negativa = await cerrar(recepcion, {
      items: [item(id)],
      pagos: [{ metodoId: transferencia, monto: 45000, propina: -1 }],
    });
    expect(negativa.error?.message).toBe("Revisa la propina");
    const r = await cerrar(recepcion, {
      items: [item(id)],
      pagos: [
        { metodoId: efectivo, monto: 45000, recibido: 52000, propina: 5000 },
      ],
    });
    expect(r).toMatchObject({ ok: true, vuelto: 2000, estado: "pagada" });
    const { data: pagos } = await duena
      .from("pagos")
      .select("monto, propina, recibido")
      .eq("venta_id", r.ventaId!);
    expect(pagos).toEqual([{ monto: 45000, propina: 5000, recibido: 52000 }]);
    const { data: caja } = await duena
      .from("movimientos_caja")
      .select("monto")
      .eq("venta_id", r.ventaId!);
    expect(caja).toEqual([{ monto: 45000 }]);
  });

  it("el comprobante se manda por un solo canal si se pide (0019)", async () => {
    const id = await nuevaCita();
    const r = await cerrar(recepcion, {
      items: [item(id)],
      pagos: [{ metodoId: transferencia, monto: 45000 }],
    });
    const { data: malo } = await recepcion.rpc("enviar_comprobante", {
      p_venta: r.ventaId!,
      p_canal: "fax",
    });
    expect((malo as unknown as Resultado).ok).toBe(false);
    const { data: envio } = await recepcion.rpc("enviar_comprobante", {
      p_venta: r.ventaId!,
      p_canal: "correo",
    });
    expect((envio as unknown as Resultado).ok).toBe(true);
    const { data: avisos } = await recepcion
      .from("avisos_demo")
      .select("canal")
      .eq("venta_id", r.ventaId!);
    expect(avisos?.map((a) => a.canal)).toEqual(["correo"]);
  });
});

describe("caja y numeración", () => {
  it("el dueño registra un egreso y rectifica con la diferencia y su signo", async () => {
    const { data: e } = await duena.rpc("registrar_movimiento", {
      p: {
        localId: LOCAL,
        tipo: "egreso",
        monto: 12000,
        concepto: "Prueba de egreso",
      },
    });
    expect((e as unknown as Resultado).ok).toBe(true);
    const { data: caja } = await duena
      .from("movimientos_caja")
      .select("id, monto, efectivo");
    const egreso = caja?.find((m) => m.monto === -12000);
    expect(egreso).toBeDefined();
    movimientos.push(egreso!.id);
    const esperado = (caja ?? [])
      .filter((m) => m.efectivo)
      .reduce((s, m) => s + m.monto, 0);

    const { data: rect } = await duena.rpc("rectificar_caja", {
      p_local: LOCAL,
      p_contado: esperado + 1000,
    });
    expect(rect).toMatchObject({ ok: true, esperado, diferencia: 1000 });
    const { data: ultimo } = await duena
      .from("movimientos_caja")
      .select("id")
      .eq("tipo", "rectificacion")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    movimientos.push(ultimo!.id);
  });

  it("recepción no ve ni mueve la caja", async () => {
    const { data } = await recepcion
      .from("movimientos_caja")
      .select("id")
      .limit(1);
    expect(data ?? []).toHaveLength(0);
    const { data: r } = await recepcion.rpc("registrar_movimiento", {
      p: {
        localId: LOCAL,
        tipo: "ingreso",
        monto: 1000,
        concepto: "No debería",
      },
    });
    expect((r as unknown as Resultado).error?.code).toBe("SIN_PERMISO");
  });

  it("la numeración solo avanza y deja historial", async () => {
    const { data: a } = await duena
      .from("ajustes")
      .select("venta_siguiente")
      .single();
    const actual = a!.venta_siguiente;
    const { data: atras } = await duena.rpc("ajustar_numeracion", {
      p_prefijo: "",
      p_siguiente: actual - 1,
    });
    expect((atras as unknown as Resultado).error?.message).toMatch(
      /^El número debe ser mayor al último usado/,
    );
    const { data: prefijo } = await duena.rpc("ajustar_numeracion", {
      p_prefijo: "F1",
      p_siguiente: 1,
    });
    expect((prefijo as unknown as Resultado).error?.field).toBe("prefijo");
    const { data: adelante } = await duena.rpc("ajustar_numeracion", {
      p_prefijo: "",
      p_siguiente: actual + 10,
    });
    expect((adelante as unknown as Resultado).ok).toBe(true);
    const { data: historial } = await duena
      .from("numeracion_cambios")
      .select("siguiente_antes, siguiente");
    expect(historial).toContainEqual({
      siguiente_antes: actual,
      siguiente: actual + 10,
    });
    await servicio
      .from("ajustes")
      .update({ venta_siguiente: actual })
      .eq("negocio_id", NEGOCIO_DEMO);
  });
});

describe("permisos de ventas", () => {
  it("anónimo no lee ventas, pagos, caja ni métodos, y no puede cobrar", async () => {
    const anon = clienteAnonimo();
    for (const tabla of [
      "ventas",
      "venta_items",
      "pagos",
      "movimientos_caja",
      "metodos_pago",
      "numeracion_cambios",
    ] as const) {
      const { data, error } = await anon.from(tabla).select("id").limit(1);
      expect(error?.code === "42501" || (data ?? []).length === 0, tabla).toBe(
        true,
      );
    }
    const { error } = await anon.rpc("cerrar_venta", { p: {} });
    expect(error?.code).toBe("42501");
  });

  it("el profesional no ve ventas ni puede cobrar", async () => {
    const carolina = await clienteComo("carolina@salonceiba.test");
    const { data } = await carolina.from("ventas").select("id").limit(1);
    expect(data ?? []).toHaveLength(0);
    const { data: r } = await carolina.rpc("cerrar_venta", {
      p: { localId: LOCAL, items: [] },
    });
    expect((r as unknown as Resultado).error?.code).toBe("SIN_PERMISO");
  });
});

describe("base de clientes", () => {
  it("busca, ordena, pagina y cuenta el total", async () => {
    const { data } = await recepcion.rpc("listar_clientes", {
      p: { limite: 25, pagina: 1 },
    });
    expect(data).toHaveLength(25);
    // Al menos los 80 de la semilla: publico.test.ts crea clientes mientras esta corre en paralelo.
    expect(Number(data![0].total)).toBeGreaterThanOrEqual(80);
    const apellidos = data!.map((c) => c.apellido.toLowerCase());
    expect([...apellidos].sort((a, b) => a.localeCompare(b, "es"))).toEqual(
      apellidos,
    );
    const { data: ana } = await recepcion.rpc("listar_clientes", {
      p: { texto: "ana garc" },
    });
    expect(ana?.length).toBeGreaterThan(0);
    expect(
      ana?.every((c) =>
        `${c.nombre} ${c.apellido}`.toLowerCase().includes("ana garc"),
      ),
    ).toBe(true);
    const { data: nadie } = await recepcion.rpc("listar_clientes", {
      p: { texto: "zzzz" },
    });
    expect(nadie).toHaveLength(0);
  });
});

describe("productos e inventario", () => {
  let productoId: string;
  const nombre = "Producto de prueba de integración";

  async function existencias() {
    const { data } = await servicio
      .from("productos")
      .select("existencias")
      .eq("id", productoId)
      .single();
    return data!.existencias;
  }

  beforeAll(async () => {
    await servicio.from("productos").delete().eq("nombre", nombre);
    const { data, error } = await duena
      .from("productos")
      .insert({
        negocio_id: NEGOCIO_DEMO,
        nombre,
        precio: 30000,
        stock_minimo: 2,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "sin producto");
    productoId = data.id;
  });

  afterAll(async () => {
    // El afterAll de arriba borra las ventas después; aquí se sueltan sus ítems para poder borrar el producto.
    await servicio.from("venta_items").delete().eq("producto_id", productoId);
    await servicio.from("productos").delete().eq("id", productoId);
  });

  it("las existencias no se escriben directo: entran y se cuentan por la función, solo el dueño", async () => {
    const directo = await duena
      .from("productos")
      .update({ existencias: 50 })
      .eq("id", productoId);
    expect(directo.error).not.toBeNull();
    const { data: r } = await recepcion.rpc("mover_existencias", {
      p_producto: productoId,
      p_tipo: "entrada",
      p_cantidad: 5,
      p_nota: "",
    });
    expect((r as unknown as Resultado).error?.code).toBe("SIN_PERMISO");
    await duena.rpc("mover_existencias", {
      p_producto: productoId,
      p_tipo: "entrada",
      p_cantidad: 5,
      p_nota: "Pedido de prueba",
    });
    const { data: conteo } = await duena.rpc("mover_existencias", {
      p_producto: productoId,
      p_tipo: "conteo",
      p_cantidad: 3,
      p_nota: "Conteo de prueba",
    });
    expect(conteo).toMatchObject({ ok: true, existencias: 3, cambio: -2 });
    const { data: movs } = await duena
      .from("movimientos_stock")
      .select("tipo, cantidad")
      .eq("producto_id", productoId)
      .order("created_at");
    expect(movs).toEqual([
      { tipo: "entrada", cantidad: 5 },
      { tipo: "ajuste", cantidad: -2 },
    ]);
  });

  it("vender descuenta, no deja vender más de lo que hay y anular devuelve", async () => {
    const producto = (cantidad: number) => ({
      productoId,
      servicioId: null,
      citaId: null,
      profesionalId: CAROLINA,
      descripcion: "",
      cantidad,
      precioUnitario: 30000,
    });
    const mucho = await cerrar(recepcion, {
      items: [producto(2), producto(2)],
      pagos: [{ metodoId: transferencia, monto: 120000 }],
    });
    expect(mucho.error).toMatchObject({
      code: "SIN_EXISTENCIAS",
      message: `Solo quedan 3 de ${nombre}`,
    });
    const mezcla = await cerrar(recepcion, {
      items: [{ ...producto(1), servicioId }],
      pagos: [{ metodoId: transferencia, monto: 30000 }],
    });
    expect(mezcla.error?.code).toBe("VALIDACION");

    const venta = await cerrar(recepcion, {
      items: [producto(2)],
      pagos: [{ metodoId: transferencia, monto: 60000 }],
    });
    expect(venta.ok).toBe(true);
    expect(await existencias()).toBe(1);
    const { data: item } = await servicio
      .from("venta_items")
      .select("descripcion, producto_id")
      .eq("venta_id", venta.ventaId!)
      .single();
    expect(item).toEqual({ descripcion: nombre, producto_id: productoId });

    // Un producto vendido no se borra (se desactiva).
    const borrar = await duena.from("productos").delete().eq("id", productoId);
    expect(borrar.error?.code).toBe("23503");

    const { data: anulada } = await duena.rpc("anular_venta", {
      p_venta: venta.ventaId!,
      p_motivo: "Prueba de inventario",
    });
    expect(anulada).toMatchObject({ ok: true });
    expect(await existencias()).toBe(3);
    const { data: movs } = await duena
      .from("movimientos_stock")
      .select("tipo, cantidad")
      .eq("venta_id", venta.ventaId!)
      .order("created_at");
    expect(movs).toEqual([
      { tipo: "venta", cantidad: -2 },
      { tipo: "anulacion", cantidad: 2 },
    ]);
  });
});
