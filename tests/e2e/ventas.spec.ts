import { expect, test, type Locator, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { clienteServicio, NEGOCIO_DEMO } from "../integracion/ayuda";
import { ahoraEnZona } from "../../src/features/agenda/lib/fechas";
import { pesos } from "../../src/shared/lib/formato";

// Cobro de punta a punta: abono desde Mis cobros, saldo en efectivo con vuelto, la venta en Detalle, sus pagos en
// Transacciones y en la Caja, anular (la cita vuelve a Mis cobros), egreso y rectificar el efectivo. Cada tamaño
// usa su propio profesional y un cliente creado para la prueba; la cita es de hoy a las 6:00 (fuera del horario,
// para no tocar la agenda de las otras pruebas). La numeración se devuelve al final (numeracion-global.ts).
type Cliente = SupabaseClient<Database>;

const LOCAL = "a1000000-0000-4000-8000-000000000001";
const PROS: Record<string, string> = {
  computador: "b0000000-0000-4000-8000-000000000001",
  "tableta-horizontal": "b0000000-0000-4000-8000-000000000002",
  "tableta-vertical": "b0000000-0000-4000-8000-000000000003",
  celular: "b0000000-0000-4000-8000-000000000004",
};
const PRECIO = 50000;

let servicio: Cliente;
let proyecto: string;
let proId: string;
let apellido: string;
let clienteId: string;
let contadoUsado: number | null = null;

async function limpiar() {
  const { data: clientes } = await servicio
    .from("clientes")
    .select("id")
    .eq("apellido", apellido);
  const ids = (clientes ?? []).map((c) => c.id);
  if (ids.length) {
    await servicio.from("ventas").delete().in("cliente_id", ids);
    await servicio.from("citas").delete().in("cliente_id", ids);
    await servicio.from("clientes").delete().in("id", ids);
  }
  await servicio
    .from("movimientos_caja")
    .delete()
    .eq("concepto", `Compra ${apellido}`);
  if (contadoUsado !== null)
    await servicio
      .from("movimientos_caja")
      .delete()
      .eq("tipo", "rectificacion")
      .eq("contado", contadoUsado);
}

test.beforeAll(async ({}, info) => {
  proyecto = info.project.name;
  const pro = PROS[proyecto];
  if (!pro) throw new Error(`Sin profesional para ${proyecto}`);
  proId = pro;
  apellido = `Cobro E2E ${proyecto}`; // distinto del «E2E <tamaño>» que limpia citas.spec
  servicio = clienteServicio();
  await limpiar();
  const n = Object.keys(PROS).indexOf(proyecto) + 1;
  const { data: s } = await servicio
    .from("servicios")
    .select("id")
    .eq("negocio_id", NEGOCIO_DEMO)
    .eq("nombre", "Corte y barba")
    .single();
  const { data: c } = await servicio
    .from("clientes")
    .insert({
      negocio_id: NEGOCIO_DEMO,
      nombre: "Venta",
      apellido,
      correo: `venta.e2e${n}@ejemplo.test`,
      telefono: `+57300000${9900 + n}`,
    })
    .select("id")
    .single();
  if (!s || !c)
    throw new Error("Faltan datos de la semilla: corre npm run db:reset");
  clienteId = c.id;
  const { error } = await servicio.from("citas").insert({
    negocio_id: NEGOCIO_DEMO,
    local_id: LOCAL,
    cliente_id: clienteId,
    profesional_id: proId,
    servicio_id: s.id,
    fecha: ahoraEnZona().fecha,
    hora_inicio: "06:00",
    hora_fin: "06:45",
    duracion_min: 45,
    precio: PRECIO,
    estado: "asiste",
  });
  if (error) throw new Error(error.message);
});

test.afterAll(async () => {
  await limpiar();
});

async function entrarComo(page: Page, rol: RegExp) {
  await page.goto("/entrar");
  await page.getByRole("button", { name: rol }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));
}

/** Espera el aviso del servidor (no basta con que la ventana se cierre: ver Aprendizajes en AGENTS.md). */
async function aviso(page: Page, texto: string | RegExp) {
  await expect(
    page.locator("[data-sonner-toast]").filter({ hasText: texto }).first(),
  ).toBeVisible();
}

async function pagarEnEfectivo(hoja: Locator, recibido: number) {
  await hoja.getByRole("radio", { name: /Efectivo/ }).click();
  await hoja.getByLabel("Monto recibido").fill(String(recibido));
}

async function ventaDelCliente() {
  const { data } = await servicio
    .from("ventas")
    .select("id, numero, estado, pagado, total")
    .eq("cliente_id", clienteId)
    .single();
  if (!data) throw new Error("La venta no quedó en la base");
  return data;
}

test("abono, saldo con vuelto, listados, anular y caja", async ({
  page,
}, info) => {
  test.setTimeout(150_000);
  const nombre = `Venta ${apellido}`;
  const hoja = page.getByRole("dialog");
  await entrarComo(page, /Dueño/);

  // 1. Abono de $20.000 desde Mis cobros.
  await page.goto(`/ventas/cobros?profesional=${proId}`);
  const filaCita = page.getByRole("listitem").filter({ hasText: nombre });
  await filaCita.getByRole("button", { name: "Cobrar" }).click();
  await expect(hoja.getByText("Corte y barba").first()).toBeVisible();
  // En el celular, cobrar una cita va directo al pago.
  if (info.project.name !== "celular")
    await hoja.getByRole("button", { name: "Continuar" }).click();
  await hoja.getByRole("switch", { name: "Abono (pago parcial)" }).click();
  await hoja.getByLabel("Monto del abono").fill("20000");
  await pagarEnEfectivo(hoja, 20000);
  await hoja.getByRole("button", { name: `Pagar ${pesos(20000)}` }).click();
  await expect(hoja.getByText("Abono registrado")).toBeVisible();
  const abonada = await ventaDelCliente();
  expect(abonada).toMatchObject({
    estado: "parcial",
    pagado: 20000,
    total: PRECIO,
  });
  const numero = abonada.numero;
  await page.keyboard.press("Escape");

  // 2. El saldo aparece en Mis cobros y se paga con $50.000: vuelto de $20.000.
  const filaSaldo = page
    .getByRole("listitem")
    .filter({ hasText: `venta ${numero}` });
  await filaSaldo.getByRole("button", { name: "Pagar saldo" }).click();
  await expect(hoja.getByText(`Pagar saldo · Venta ${numero}`)).toBeVisible();
  await pagarEnEfectivo(hoja, 50000);
  await expect(hoja.getByText(`Vuelto: ${pesos(20000)}`)).toBeVisible();
  await hoja.getByRole("button", { name: `Pagar ${pesos(30000)}` }).click();
  await expect(hoja.getByText("El pago se realizó con éxito")).toBeVisible();
  // «Enviar» en la tableta; «Enviar por correo» en el celular.
  await hoja.getByRole("button", { name: /^Enviar( por correo)?$/ }).click();
  await aviso(page, "Comprobante enviado");
  expect(await ventaDelCliente()).toMatchObject({
    estado: "pagada",
    pagado: PRECIO,
  });
  await page.keyboard.press("Escape");

  // 3. Detalle: la venta pagada; Transacciones: sus dos pagos; Caja: los dos ingresos de hoy.
  await page.goto(`/ventas/detalle?q=${numero}`);
  await page.getByRole("button", { name: `Ver la venta ${numero}` }).click();
  const ventana = page.getByRole("dialog");
  await expect(ventana.getByText(`Venta ${numero}`).first()).toBeVisible();
  await expect(ventana.getByText("Pagada").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto(`/ventas/transacciones?q=${numero}`);
  await expect(
    page.getByRole("button", { name: `Ver la venta ${numero}` }),
  ).toHaveCount(2);
  await page.goto("/ventas/caja?tipo=ventas");
  await expect(
    page.getByRole("button", { name: `Abono de la venta ${numero}` }),
  ).toHaveCount(2);

  // 4. Anular: la venta queda anulada, la caja devuelve los pagos y la cita vuelve a Mis cobros.
  await page.goto(`/ventas/detalle?q=${numero}`);
  await page.getByRole("button", { name: `Ver la venta ${numero}` }).click();
  await ventana.getByRole("button", { name: "Anular", exact: true }).click();
  await ventana
    .getByLabel("Motivo de la anulación")
    .fill("Prueba E2E: cobro de ensayo");
  await ventana.getByRole("button", { name: "Anular venta" }).click();
  await aviso(page, `Venta ${numero} anulada`);
  expect((await ventaDelCliente()).estado).toBe("anulada");
  await page.goto("/ventas/caja?tipo=");
  await expect(page.getByText(`Anulación de la venta ${numero}`)).toHaveCount(
    2,
  );
  await page.goto(`/ventas/cobros?profesional=${proId}`);
  await expect(filaCita.getByRole("button", { name: "Cobrar" })).toBeVisible();

  // 5. Egreso y rectificar el efectivo contado.
  await page.goto("/ventas/caja");
  await page.getByRole("button", { name: "Egresos" }).click();
  await ventana.locator("#movimiento-monto").fill("1000");
  await ventana.locator("#movimiento-concepto").fill(`Compra ${apellido}`);
  await ventana.getByRole("button", { name: "Registrar" }).click();
  await aviso(page, "Egreso registrado");
  await expect(page.getByText(`Compra ${apellido}`)).toBeVisible();
  await page.getByRole("button", { name: "Rectificar efectivo" }).click();
  const esperado = Number(
    (
      (await ventana
        .getByText("Efectivo esperado")
        .locator("xpath=following-sibling::span")
        .textContent()) ?? ""
    ).replace(/\D/g, ""),
  );
  // Los montos de la caja van en miles: sumar 1.111 por tamaño hace que dos tamaños nunca cuenten lo mismo.
  contadoUsado = esperado + 1111 * (Object.keys(PROS).indexOf(proyecto) + 1);
  await ventana.locator("#movimiento-monto").fill(String(contadoUsado));
  await expect(ventana.getByText("Sobrante", { exact: true })).toBeVisible();
  await ventana.getByRole("button", { name: "Rectificar" }).click();
  // El de la rectificación: «Egreso registrado» sigue a la vista y con /registrado/ la prueba se iba antes de
  // guardar. La diferencia exacta puede cambiar si otro tamaño mueve la misma caja en paralelo.
  await aviso(page, /^(Sobrante de|Faltante de|Caja cuadrada)/);
  await page.goto("/ventas/caja?tipo=rectificacion");
  await expect(page.getByText(`Contado: ${pesos(contadoUsado)}`)).toBeVisible();
});

test("recepción cobra pero no anula ni entra a la caja", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "computador", "una vez basta");
  await entrarComo(page, /Recepción/);
  // Hasta ayer: las ventas de hoy son las de las otras pruebas, que se borran en paralelo (y el día 1 del mes son
  // las únicas del período por defecto).
  const d = new Date(`${ahoraEnZona().fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  const ayer = d.toISOString().slice(0, 10);
  d.setUTCDate(d.getUTCDate() - 27);
  await page.goto(
    `/ventas/detalle?desde=${d.toISOString().slice(0, 10)}&hasta=${ayer}`,
  );
  await page
    .getByRole("button", { name: /^Ver la venta/ })
    .first()
    .click();
  const ventana = page.getByRole("dialog");
  await expect(ventana.getByText("Pagos", { exact: true })).toBeVisible();
  await expect(ventana.getByRole("button", { name: "Anular" })).toHaveCount(0);
  await page.goto("/ventas/caja");
  await page.waitForURL(/\/agenda\?aviso=sin-permiso/);
});
