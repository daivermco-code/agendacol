import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { clienteServicio, NEGOCIO_DEMO } from "../integracion/ayuda";
import { ahoraEnZona } from "../../src/features/agenda/lib/fechas";
import { pesos } from "../../src/shared/lib/formato";
import { chicos } from "./ayuda-44";

// Ventas en el celular (T-12.11): la lista con fichas, flechas y propinas; una venta completa desde el botón
// flotante (carrito, descuento, efectivo con propina, comprobante con WhatsApp y correo, y la vuelta a Ventas);
// salir sin cobrar con la X o Escape; una venta de $0; y cobrar una cita desde su ficha con «Volver a la cita».
// Solo en el proyecto celular; el cliente es propio («Celular E2E») y se borra con sus ventas y su cita al final.
// La cita va en la semana 22 desde hoy (las otras pruebas usan hasta la 20).

const APELLIDO = "Celular E2E";
const SERVICIO = "Arreglo de barba"; // $20.000 en la semilla
const LOCAL = "a1000000-0000-4000-8000-000000000001";
const PRO_CELULAR = "b0000000-0000-4000-8000-000000000004";

let servicio: SupabaseClient<Database>;
let clienteId: string;
let citaFecha: string;

async function entrarComo(page: Page, rol: RegExp) {
  await page.goto("/entrar");
  await page.getByRole("button", { name: rol }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));
}

function diaMas(n: number) {
  const d = new Date(`${ahoraEnZona().fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function limpiar() {
  const { data } = await servicio
    .from("clientes")
    .select("id")
    .eq("apellido", APELLIDO);
  const ids = (data ?? []).map((c) => c.id);
  if (!ids.length) return;
  await servicio.from("ventas").delete().in("cliente_id", ids);
  await servicio.from("citas").delete().in("cliente_id", ids);
  await servicio.from("clientes").delete().in("id", ids);
}

/** La venta del cliente con ese total (cada prueba cobra un total distinto). */
async function ventaDe(total: number) {
  const { data } = await servicio
    .from("ventas")
    .select("id, numero, total, descuento, pagos(monto, propina, recibido)")
    .eq("cliente_id", clienteId)
    .eq("total", total)
    .single();
  if (!data) throw new Error(`No quedó la venta de ${pesos(total)}`);
  return data;
}

test.beforeAll(async ({}, info) => {
  if (info.project.name !== "celular") return;
  servicio = clienteServicio();
  await limpiar();
  const { data, error } = await servicio
    .from("clientes")
    .insert({
      negocio_id: NEGOCIO_DEMO,
      nombre: "Lucía",
      apellido: APELLIDO,
      correo: "lucia.celular.e2e@ejemplo.test",
      telefono: "+573009990077",
    })
    .select("id")
    .single();
  if (error || !data)
    throw new Error(`No se creó el cliente: ${error?.message}`);
  clienteId = data.id;
  const { data: s } = await servicio
    .from("servicios")
    .select("id")
    .eq("negocio_id", NEGOCIO_DEMO)
    .eq("nombre", SERVICIO)
    .single();
  if (!s) throw new Error("Faltan datos de la semilla: corre npm run db:reset");
  citaFecha = diaMas(7 * 22);
  const { error: e2 } = await servicio.from("citas").insert({
    negocio_id: NEGOCIO_DEMO,
    local_id: LOCAL,
    cliente_id: clienteId,
    profesional_id: PRO_CELULAR,
    servicio_id: s.id,
    fecha: citaFecha,
    hora_inicio: "10:00",
    hora_fin: "10:30",
    duracion_min: 30,
    precio: 25000,
    estado: "confirmado",
  });
  if (e2) throw new Error(`No se creó la cita: ${e2.message}`);
});

test.afterAll(async ({}, info) => {
  if (info.project.name === "celular") await limpiar();
});

test.describe("Ventas en el celular", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "celular", "solo en el celular");
  });

  test("fichas, flechas, propinas y el detalle desde la fila", async ({
    page,
  }) => {
    await entrarComo(page, /Recepción/);
    // Una fecha que no existe en la dirección no tumba la página: abre en hoy.
    await page.goto("/ventas/detalle?dia=2026-02-30");
    await expect(
      page.getByRole("heading", { name: "Ventas", exact: true }),
    ).toBeVisible();
    const fichas = page.getByRole("group", { name: "Período" });
    await expect(fichas.getByRole("button", { name: "Hoy" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // En el período de hoy no hay flecha siguiente; al ir atrás aparece.
    await expect(
      page.getByRole("button", { name: "Período siguiente" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Período anterior" }).click();
    await page.waitForURL(new RegExp(`dia=${diaMas(-1)}`));
    await expect(page.getByText("Ayer", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Período siguiente" }),
    ).toBeVisible();

    await fichas.getByRole("button", { name: "Mes" }).click();
    await page.waitForURL(/vista=mes/);
    await expect(fichas.getByRole("button", { name: "Mes" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Propinas de las últimas 4 semanas (la semilla deja propinas con tarjeta y billetera).
    await page.goto(
      `/ventas/detalle?pestana=propinas&desde=${diaMas(-28)}&hasta=${diaMas(-1)}`,
    );
    await expect(page.getByRole("tab", { name: "Propinas" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("tabpanel")).toBeVisible();
    await expect(page.getByText(/^\d+ propinas?/)).toBeVisible();
    const fila = page.getByRole("button", { name: /propina de \$/ }).first();
    await expect(fila).toContainText("propina");
    await fila.click();
    await expect(
      page.getByRole("dialog").getByText("Pagos", { exact: true }),
    ).toBeVisible();
  });

  test("venta completa: carrito, descuento, propina, comprobante y vuelta", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const malos: string[] = [];
    await entrarComo(page, /Dueño/);
    await page.goto("/ventas/detalle");
    const hoja = page.getByRole("dialog");
    await page.getByRole("button", { name: "Nueva venta" }).click();

    // 1. Carrito vacío → catálogo → el servicio → de vuelta al carrito.
    await expect(hoja.getByText("Carrito vacío")).toBeVisible();
    malos.push(...(await chicos(page, "carrito vacío")));
    await expect(
      hoja.getByRole("button", { name: "Elegir cómo pagar" }),
    ).toBeDisabled();
    await hoja.getByRole("button", { name: "Agregar al carrito" }).click();
    await hoja.getByRole("button", { name: /^Servicios/ }).click();
    await expect(
      hoja.getByRole("button", { name: `Agregar ${SERVICIO}` }),
    ).toBeVisible();
    malos.push(...(await chicos(page, "catálogo")));
    await hoja.getByRole("button", { name: `Agregar ${SERVICIO}` }).click();
    await hoja.getByRole("button", { name: "Ir al carrito (1)" }).click();
    await expect(hoja.getByText(SERVICIO)).toBeVisible();
    malos.push(...(await chicos(page, "carrito")));

    // 2. Cliente y descuento de $1.000 (monto fijo); el cuadro se sigue llamando «Descuento».
    await hoja.getByRole("button", { name: /^Cliente/ }).click();
    await hoja
      .getByPlaceholder("Nombre, documento, correo o teléfono")
      .fill(APELLIDO);
    await hoja
      .getByRole("list", { name: "Clientes encontrados" })
      .getByRole("button", { name: new RegExp(APELLIDO) })
      .click();
    await expect(
      hoja.getByRole("button", { name: `Cliente: Lucía ${APELLIDO}` }),
    ).toBeVisible();
    await hoja.getByRole("button", { name: "Descuento", exact: true }).click();
    const descuento = page.getByRole("dialog", { name: "Descuento" });
    await descuento.getByRole("radio", { name: "Monto fijo" }).click();
    await descuento.getByLabel("Descuento en pesos").fill("1000");
    await expect(descuento.getByText(pesos(19000))).toBeVisible();
    malos.push(...(await chicos(page, "hoja descuento")));
    await descuento.getByRole("button", { name: "Aplicar descuento" }).click();
    await expect(hoja.getByText(pesos(19000))).toBeVisible();
    // Al cerrar la hoja, el foco vuelve al cuadro que la abrió.
    await expect(
      hoja.getByRole("button", { name: `Descuento: −${pesos(1000)}` }),
    ).toBeFocused();

    // 3. Efectivo con 10 % de propina; cambiar el descuento a $2.000 desde el cobro conserva lo elegido.
    await hoja.getByRole("button", { name: "Elegir cómo pagar" }).click();
    await hoja.getByRole("radio", { name: /Efectivo/ }).click();
    malos.push(...(await chicos(page, "cobro en efectivo")));
    await hoja.getByRole("radio", { name: "10 %" }).click();
    await expect(
      hoja.getByText(`${pesos(1900)} para el profesional`),
    ).toBeVisible();
    await hoja
      .getByRole("button", { name: `Descuento: −${pesos(1000)}` })
      .click();
    await descuento.getByLabel("Descuento en pesos").fill("2000");
    await descuento.getByRole("button", { name: "Aplicar descuento" }).click();
    await expect(hoja.getByRole("radio", { name: /Efectivo/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(
      hoja.getByText(`${pesos(1800)} para el profesional`),
    ).toBeVisible();
    await hoja.getByLabel("Monto recibido").fill("20000");
    await expect(hoja.getByText(`Vuelto: ${pesos(200)}`)).toBeVisible();
    await hoja
      .getByRole("button", { name: `Pagar ${pesos(19800)} con propina` })
      .click();
    await expect(hoja.getByText("El pago se realizó con éxito")).toBeVisible();
    malos.push(...(await chicos(page, "comprobante")));

    const venta = await ventaDe(18000);
    expect(venta).toMatchObject({
      descuento: 2000,
      pagos: [{ monto: 18000, propina: 1800, recibido: 20000 }],
    });

    // 4. Comprobante: WhatsApp con el número del cliente y el mensaje; el correo queda en el buzón de la demo.
    const whatsapp = hoja.getByRole("link", { name: "Enviar por WhatsApp" });
    await expect(whatsapp).toHaveAttribute(
      "href",
      new RegExp(`^https://wa\\.me/573009990077\\?text=Hola%20Luc%C3%ADa`),
    );
    await hoja.getByRole("button", { name: "Enviar por correo" }).click();
    await expect(
      page
        .locator("[data-sonner-toast]")
        .filter({ hasText: "Comprobante enviado por correo" }),
    ).toBeVisible();
    const { data: avisos } = await servicio
      .from("avisos_demo")
      .select("canal")
      .eq("venta_id", venta.id);
    expect(avisos).toEqual([{ canal: "correo" }]);

    // 5. Volver a Ventas: la venta nueva está en la lista de hoy y el foco vuelve al botón flotante.
    await hoja.getByRole("button", { name: "Volver a Ventas" }).click();
    await expect(hoja).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: `Ver la venta ${venta.numero}` }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Nueva venta" }),
    ).toBeFocused();

    expect(malos).toEqual([]);
  });

  test("la flecha y Escape preguntan antes de vaciar el carrito; una venta de $0 se registra", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await entrarComo(page, /Dueño/);
    await page.goto("/ventas/detalle");
    const hoja = page.getByRole("dialog").first();
    await page.getByRole("button", { name: "Nueva venta" }).click();
    await hoja.getByRole("button", { name: "Agregar al carrito" }).click();
    await hoja.getByRole("button", { name: /^Servicios/ }).click();
    await hoja.getByRole("button", { name: `Agregar ${SERVICIO}` }).click();
    await hoja.getByRole("button", { name: "Ir al carrito (1)" }).click();

    // En el carrito del celular no hay X (sobra con la flecha); la flecha y Escape hacen la misma pregunta.
    const pregunta = page.getByRole("dialog", { name: "¿Salir sin cobrar?" });
    await expect(
      hoja.getByRole("button", { name: "Cerrar", exact: true }),
    ).toBeHidden();
    await hoja.getByRole("button", { name: "Atrás", exact: true }).click();
    await expect(pregunta).toBeVisible();
    await pregunta.getByRole("button", { name: "Cancelar" }).click();
    // La pregunta pierde su título apenas se cierra, pero sigue en el DOM mientras se anima (y recibiría el
    // Escape): se espera a que solo quede el panel.
    await expect(page.locator('[role="dialog"]')).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(pregunta).toBeVisible();
    await pregunta.getByRole("button", { name: "Cancelar" }).click();
    await expect(hoja.getByText(SERVICIO)).toBeVisible();

    // Descuento del 100 %: no hay nada que pagar y la venta se registra sin pagos.
    await hoja.getByRole("button", { name: /^Cliente/ }).click();
    await hoja
      .getByPlaceholder("Nombre, documento, correo o teléfono")
      .fill(APELLIDO);
    await hoja
      .getByRole("list", { name: "Clientes encontrados" })
      .getByRole("button", { name: new RegExp(APELLIDO) })
      .click();
    await hoja.getByRole("button", { name: "Descuento", exact: true }).click();
    const descuento = page.getByRole("dialog", { name: "Descuento" });
    await descuento.getByLabel("Descuento en porcentaje").fill("100");
    await descuento.getByRole("button", { name: "Aplicar descuento" }).click();
    await hoja.getByRole("button", { name: "Elegir cómo pagar" }).click();
    await expect(hoja.getByText("No hay nada que cobrar")).toBeVisible();
    await hoja.getByRole("button", { name: "Registrar venta" }).click();
    await expect(hoja.getByText("El pago se realizó con éxito")).toBeVisible();
    const venta = await ventaDe(0);
    expect(venta).toMatchObject({ descuento: 20000, pagos: [] });
  });

  test("cobrar la cita desde su ficha y «Volver a la cita»", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await entrarComo(page, /Dueño/);
    await page.goto(`/agenda?vista=lista&fecha=${citaFecha}`);
    await page
      .getByRole("button", {
        name: new RegExp(`^Ver la cita de Lucía ${APELLIDO}`),
      })
      .click();
    await page.getByRole("button", { name: `Pagar ${pesos(25000)}` }).click();

    // Desde la cita se va directo al pago, con lo que se cobra a la vista.
    const panel = page.getByRole("dialog", { name: "Método de pago" });
    await expect(
      panel.getByRole("list", { name: "Lo que se cobra" }),
    ).toContainText(SERVICIO);
    await panel.getByRole("radio", { name: /Efectivo/ }).click();
    await panel.getByLabel("Monto recibido").fill("25000");
    await panel.getByRole("button", { name: `Pagar ${pesos(25000)}` }).click();
    await expect(page.getByText("El pago se realizó con éxito")).toBeVisible();
    await page.getByRole("button", { name: "Volver a la cita" }).click();

    // La ficha se abre otra vez, ya pagada.
    await expect(
      page.getByRole("dialog").getByText("Pagada", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Ver venta" })).toBeVisible();
    await ventaDe(25000);
  });
});
