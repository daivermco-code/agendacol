import { expect, test, type Locator, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { clienteServicio, NEGOCIO_DEMO } from "../integracion/ayuda";
import { pesos } from "../../src/shared/lib/formato";

// Gift cards y planes de punta a punta: vender una gift card de $100.000 (el código sale en el comprobante),
// venderle al mismo cliente el plan «Manos lindas» ($99.000) pagando con ese código (le queda $1.000) y verlos en
// sus listados. Cada tamaño usa su propio cliente; al final se borran sus ventas, la del canje primero (su pago
// apunta a la gift card), y el cliente. La numeración se devuelve al final (numeracion-global.ts).
type Cliente = SupabaseClient<Database>;

const TAMANOS = [
  "computador",
  "tableta-horizontal",
  "tableta-vertical",
  "celular",
];

let servicio: Cliente;
let apellido: string;

async function limpiar() {
  const { data: clientes } = await servicio
    .from("clientes")
    .select("id")
    .eq("apellido", apellido);
  const ids = (clientes ?? []).map((c) => c.id);
  if (!ids.length) return;
  const { data: ventas } = await servicio
    .from("ventas")
    .select("id")
    .in("cliente_id", ids)
    .order("created_at", { ascending: false });
  for (const v of ventas ?? [])
    await servicio.from("ventas").delete().eq("id", v.id);
  await servicio.from("clientes").delete().in("id", ids);
}

test.beforeAll(async ({}, info) => {
  servicio = clienteServicio();
  apellido = `Regalo E2E ${info.project.name}`;
  await limpiar();
  const n = TAMANOS.indexOf(info.project.name) + 1;
  const { error } = await servicio.from("clientes").insert({
    negocio_id: NEGOCIO_DEMO,
    nombre: "Regalo",
    apellido,
    correo: `regalo.e2e${n}@ejemplo.test`,
    telefono: `+57300000${9800 + n}`,
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

/** Agrega un ítem desde su atajo; en el celular, antes abre el catálogo desde el carrito. */
async function agregar(hoja: Locator, atajo: RegExp, nombre: string) {
  const carrito = hoja.getByRole("button", { name: "Agregar al carrito" });
  await expect(
    hoja.getByRole("button", { name: atajo }).or(carrito).first(),
  ).toBeVisible();
  if (await carrito.isVisible()) await carrito.click();
  await hoja.getByRole("button", { name: atajo }).click();
  await hoja.getByRole("button", { name: `Agregar ${nombre}` }).click();
}

/** Busca el cliente de la prueba en la pestaña Clientes y lo elige (en celular, el panel vuelve a la venta). */
async function elegirCliente(hoja: Locator) {
  await hoja.getByRole("tab", { name: /^Clientes/ }).click();
  await hoja
    .getByPlaceholder("Nombre, documento, correo o teléfono")
    .fill(apellido);
  await hoja
    .getByRole("list", { name: "Clientes encontrados" })
    .getByRole("button", { name: new RegExp(apellido) })
    .click();
}

async function saldo(codigo: string) {
  const { data } = await servicio
    .from("gift_cards")
    .select("saldo")
    .eq("codigo", codigo)
    .single();
  return data?.saldo;
}

/** La fila visible: en la tabla (computador) o en la lista (tableta y celular). */
const filaCon = (page: Page, texto: string) =>
  page
    .getByRole("row")
    .filter({ hasText: texto })
    .or(page.getByRole("listitem").filter({ hasText: texto }))
    .filter({ visible: true });

test("vender una gift card, canjearla en un plan y verlos en sus listados", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const hoja = page.getByRole("dialog");
  await entrarComo(page, /Dueño/);

  // 1. Gift card de $100.000 a nombre del cliente, en efectivo: el comprobante trae el código.
  await page.goto("/ventas/detalle");
  await page.getByRole("button", { name: "Nueva venta" }).click();
  await agregar(hoja, /^Gift cards/, "Gift card de $100.000");
  await elegirCliente(hoja);
  await hoja
    .getByRole("button", { name: /^(Continuar|Elegir cómo pagar)$/ })
    .click();
  await hoja.getByRole("radio", { name: /Efectivo/ }).click();
  await hoja.getByLabel("Monto recibido").fill("100000");
  await hoja.getByRole("button", { name: `Pagar ${pesos(100000)}` }).click();
  await expect(hoja.getByText("El pago se realizó con éxito")).toBeVisible();
  const tarjeta = hoja.getByRole("region", { name: "Gift cards vendidas" });
  await expect(tarjeta.getByText(`Saldo ${pesos(100000)}`)).toBeVisible();
  const codigo = (await tarjeta.locator("p.text-xl").textContent())?.trim();
  if (!codigo) throw new Error("El comprobante no trae el código");
  expect(await saldo(codigo)).toBe(100000);
  await page.keyboard.press("Escape");

  // 2. El plan «Manos lindas» al mismo cliente, pagado con el código: a la gift card le queda $1.000.
  await page.getByRole("button", { name: "Nueva venta" }).click();
  await agregar(hoja, /^Planes/, "Manos lindas");
  await elegirCliente(hoja);
  await hoja
    .getByRole("button", { name: /^(Continuar|Elegir cómo pagar)$/ })
    .click();
  await hoja.getByRole("radio", { name: /Gift card/ }).click();
  await hoja.getByLabel("Código de la gift card").fill(codigo);
  await hoja.getByRole("button", { name: `Pagar ${pesos(99000)}` }).click();
  await expect(hoja.getByText("El pago se realizó con éxito")).toBeVisible();
  expect(await saldo(codigo)).toBe(1000);
  await page.keyboard.press("Escape");

  // 3. Los listados: la gift card con su saldo y el plan activo a nombre del cliente.
  await page.goto("/ventas/gift-cards");
  await page.getByPlaceholder("Código, cliente o para quién").fill(codigo);
  await expect(filaCon(page, codigo).first()).toContainText(
    `${pesos(1000)} de ${pesos(100000)}`,
  );
  await page.goto("/ventas/planes");
  await page.getByPlaceholder("Cliente o plan").fill(apellido);
  const plan = filaCon(page, apellido);
  await expect(plan.getByText("Manos lindas").first()).toBeVisible();
  await expect(plan.getByText("Activo").first()).toBeVisible();
});
