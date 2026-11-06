import { expect, test, type Locator, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { clienteServicio, NEGOCIO_DEMO } from "../integracion/ayuda";
import { pesos } from "../../src/shared/lib/formato";

// Inventario de punta a punta: crear un producto (queda en stock bajo), entrada de mercancía, venderlo en el
// panel (las existencias bajan) y la alerta en el Resumen. Cada tamaño usa su propio producto; al final se borran
// sus ventas y el producto. La numeración de ventas se devuelve al final (numeracion-global.ts).
type Cliente = SupabaseClient<Database>;

let servicio: Cliente;
let nombre: string;

async function limpiar() {
  const { data: p } = await servicio
    .from("productos")
    .select("id")
    .eq("nombre", nombre)
    .maybeSingle();
  if (!p) return;
  const { data: items } = await servicio
    .from("venta_items")
    .select("venta_id")
    .eq("producto_id", p.id);
  const ventas = [...new Set((items ?? []).map((i) => i.venta_id))];
  if (ventas.length) await servicio.from("ventas").delete().in("id", ventas);
  await servicio.from("productos").delete().eq("id", p.id);
}

test.beforeAll(async ({}, info) => {
  servicio = clienteServicio();
  nombre = `Producto E2E ${info.project.name}`;
  await limpiar();
});

test.afterAll(async () => {
  await limpiar();
});

async function entrarComo(page: Page, rol: RegExp) {
  await page.goto("/entrar");
  await page.getByRole("button", { name: rol }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));
}

async function aviso(page: Page, texto: string | RegExp) {
  await expect(
    page.locator("[data-sonner-toast]").filter({ hasText: texto }).first(),
  ).toBeVisible();
}

/** La fila del producto: en la tabla (tableta y computador) o en la lista (celular); la oculta no cuenta. */
function filaDe(page: Page): Locator {
  return page
    .getByRole("row")
    .filter({ hasText: nombre })
    .or(page.getByRole("listitem").filter({ hasText: nombre }));
}

async function existencias() {
  const { data } = await servicio
    .from("productos")
    .select("existencias")
    .eq("negocio_id", NEGOCIO_DEMO)
    .eq("nombre", nombre)
    .single();
  return data?.existencias;
}

test("crear, entrada, vender en el panel y alerta de stock bajo", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const ventana = page.getByRole("dialog");
  await entrarComo(page, /Dueño/);

  // 1. Producto nuevo con 3 unidades y mínimo 6: sale en stock bajo.
  await page.goto("/administracion/productos");
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  await ventana.getByLabel("Nombre").fill(nombre);
  await ventana.getByLabel("Categoría").fill("Pruebas");
  await ventana.getByLabel("Precio de venta").fill("15000");
  await ventana.getByLabel("Stock mínimo").fill("6");
  await ventana.getByLabel("Existencias iniciales").fill("3");
  await ventana.getByRole("button", { name: "Crear producto" }).click();
  await aviso(page, "Producto creado");
  await expect(filaDe(page).getByText("Stock bajo")).toBeVisible();
  expect(await existencias()).toBe(3);

  // 2. Entrada de 4 unidades: quedan 7 y sale de la alerta.
  await filaDe(page)
    .getByRole("button", { name: /Mover existencias/ })
    .click();
  await ventana.getByLabel("Unidades que entraron").fill("4");
  await expect(ventana.getByText("Quedarán 7")).toBeVisible();
  await ventana.getByRole("button", { name: "Registrar" }).click();
  await aviso(page, "+4 unidades: quedan 7");
  await expect(filaDe(page).getByText("Stock bajo")).toHaveCount(0);

  // 3. Venta de 2 unidades en el panel: quedan 5 (otra vez en stock bajo).
  await page.goto("/ventas/detalle");
  await page.getByRole("button", { name: "Nueva venta" }).click();
  const hoja = page.getByRole("dialog");
  // En el celular la venta abre en el carrito: el catálogo está detrás de «Agregar al carrito».
  const carrito = hoja.getByRole("button", { name: "Agregar al carrito" });
  await expect(
    hoja
      .getByRole("button", { name: /^Productos/ })
      .or(carrito)
      .first(),
  ).toBeVisible();
  if (await carrito.isVisible()) await carrito.click();
  await hoja.getByRole("button", { name: /^Productos/ }).click();
  const agregar = hoja.getByRole("button", { name: `Agregar ${nombre}` });
  await agregar.click();
  await agregar.click();
  const ver = hoja.getByRole("button", { name: /^Ir al carrito/ });
  if (await ver.isVisible()) await ver.click();
  await hoja
    .getByRole("button", { name: /^(Continuar|Elegir cómo pagar)$/ })
    .click();
  await hoja.getByRole("radio", { name: /Efectivo/ }).click();
  await hoja.getByLabel("Monto recibido").fill("30000");
  await hoja.getByRole("button", { name: `Pagar ${pesos(30000)}` }).click();
  await expect(hoja.getByText("El pago se realizó con éxito")).toBeVisible();
  expect(await existencias()).toBe(5);
  await page.keyboard.press("Escape");

  // 4. El Resumen lo muestra en «Stock bajo».
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "Stock bajo" }).getByText(nombre),
  ).toBeVisible();
});
