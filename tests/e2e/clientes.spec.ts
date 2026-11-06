import { expect, test, type Page } from "@playwright/test";
import { clienteServicio, NEGOCIO_DEMO } from "../integracion/ayuda";

// Clientes de punta a punta (flujos.md §2): buscar, crear con aviso de duplicado, abrir la ficha y borrar. Cada
// tamaño crea su propio cliente (apellido "Ficha E2E <tamaño>") y lo borra al final.
let apellido: string;
let correo: string;

async function limpiar() {
  await clienteServicio()
    .from("clientes")
    .delete()
    .eq("negocio_id", NEGOCIO_DEMO)
    .eq("apellido", apellido);
}

test.beforeAll(async ({}, info) => {
  apellido = `Ficha E2E ${info.project.name}`;
  correo = `ficha.${info.project.name}@ejemplo.test`;
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

async function aviso(page: Page, texto: string) {
  await expect(
    page.locator("[data-sonner-toast]").filter({ hasText: texto }).first(),
  ).toBeVisible();
}

test("buscar, crear con aviso de duplicado, abrir la ficha y borrar", async ({
  page,
}, info) => {
  // En el celular la lista y la ficha son otras (T-12.12): las prueba clientes-celular.spec.
  test.skip(info.project.name === "celular", "tiene su propia prueba");
  test.setTimeout(90_000);
  await entrarComo(page, /Recepción/);

  // Buscar: con resultados y sin resultados.
  await page.goto("/clientes?q=Acosta");
  await expect(
    page
      .getByRole("link", { name: "Ver ficha de Carolina Acosta" })
      .or(page.getByRole("button", { name: "Ver ficha de Carolina Acosta" })),
  ).toBeVisible();
  await page.goto("/clientes?q=zzzz");
  await expect(
    page.getByText("Nadie coincide con «zzzz»").filter({ visible: true }),
  ).toBeVisible();

  // Crear con el correo de alguien que ya existe: avisa y ofrece abrirlo; con un correo propio se crea.
  await page.goto("/clientes");
  await page.getByRole("button", { name: "Nuevo cliente" }).click();
  const ventana = page.getByRole("dialog");
  await ventana.locator("#cliente-nombre").fill("Lina");
  await ventana.locator("#cliente-apellido").fill(apellido);
  await ventana
    .locator("#cliente-correo")
    .fill("carolina.acosta17@ejemplo.test");
  await ventana.getByRole("button", { name: "Crear cliente" }).click();
  await expect(
    ventana.getByText("Ya existe alguien con esos datos"),
  ).toBeVisible();
  await expect(ventana.getByRole("link", { name: "Abrir" })).toBeVisible();
  await ventana.locator("#cliente-correo").fill(correo);
  await ventana.getByRole("button", { name: "Crear cliente" }).click();
  await aviso(page, "Cliente creado");

  // La ficha con sus pestañas.
  await page.goto(`/clientes?q=${encodeURIComponent(apellido)}`);
  await page
    .getByRole("link", { name: `Ver ficha de Lina ${apellido}` })
    .or(page.getByRole("button", { name: `Ver ficha de Lina ${apellido}` }))
    .click();
  await page.waitForURL(/\/clientes\/[0-9a-f-]{36}/);
  await expect(
    page.getByRole("heading", { name: `Lina ${apellido}` }),
  ).toBeVisible();
  for (const pestana of ["Actividad", "Asistencia", "Pagos y deudas"])
    await expect(page.getByRole("tab", { name: pestana })).toBeVisible();

  // Borrar: sin historial se puede.
  await page.goto(`/clientes?q=${encodeURIComponent(apellido)}`);
  await page.getByRole("button", { name: `Borrar a Lina ${apellido}` }).click();
  await page.getByRole("button", { name: "Borrar", exact: true }).click();
  await aviso(page, "Cliente borrado");
  await expect(
    page
      .getByText(`Nadie coincide con «${apellido}»`)
      .filter({ visible: true }),
  ).toBeVisible();
});

test("un cliente con historial no se borra", async ({ page }, info) => {
  test.skip(info.project.name !== "computador", "una vez basta");
  await entrarComo(page, /Recepción/);
  await page.goto("/clientes?q=Acosta");
  await page.getByRole("button", { name: "Borrar a Carolina Acosta" }).click();
  await page.getByRole("button", { name: "Borrar", exact: true }).click();
  await aviso(page, "Tiene historial; no se puede borrar");
});
