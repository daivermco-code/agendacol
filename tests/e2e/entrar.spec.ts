import { expect, test, type Page } from "@playwright/test";

async function entrarComo(page: Page, rol: "Dueño" | "Recepción" | "Profesional") {
  await page.goto("/entrar");
  await page.getByRole("button", { name: new RegExp(rol) }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));
}

test("sin sesión, la app lleva a /entrar y vuelve a la ruta pedida", async ({ page }) => {
  await page.goto("/clientes");
  await expect(page).toHaveURL(/\/entrar\?volver=%2Fclientes/);
  await page.getByRole("button", { name: /Dueño/ }).click();
  await expect(page).toHaveURL(/\/clientes$/);
});

test("datos incorrectos muestran un error sin decir cuál", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("Correo").fill("nadie@ejemplo.test");
  await page.getByLabel("Contraseña").fill("no-es-la-clave");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("El correo o la contraseña no coinciden")).toBeVisible();
});

test("el dueño ve el menú completo", async ({ page }, info) => {
  await entrarComo(page, "Dueño");
  if (info.project.name === "celular") {
    // En el celular: 5 pestañas abajo y el resto en el centro de Ajustes (Fase 12).
    const pestanas = page.getByRole("navigation", { name: "Pestañas" });
    for (const p of ["Inicio", "Agenda", "Clientes", "Ventas", "Ajustes"]) {
      await expect(pestanas.getByRole("link", { name: p })).toBeVisible();
    }
    await pestanas.getByRole("link", { name: "Ajustes" }).click();
    await expect(page).toHaveURL(/\/ajustes$/);
    for (const grupo of ["Mi negocio", "Clientes", "Ventas", "Reportes", "Equipo", "Ayuda"]) {
      await expect(page.getByRole("heading", { name: grupo, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: /Servicios/ })).toBeVisible();
    return;
  }
  if (info.project.name.startsWith("tableta-vertical")) {
    await page.getByRole("button", { name: "Abrir menú" }).click();
  }
  const menu = page.getByRole("navigation", { name: "Menú principal" }).last();
  for (const seccion of ["Agenda", "Ventas", "Clientes", "Reportes", "Administración"]) {
    await expect(menu.getByText(seccion, { exact: true }).first()).toBeVisible();
  }
});

test("en el celular, cada rol ve sus pestañas y su centro de Ajustes", async ({ page }, info) => {
  test.skip(info.project.name !== "celular", "solo en el celular");
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Profesional · Carolina Ruiz" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));
  const pestanas = page.getByRole("navigation", { name: "Pestañas" });
  await expect(pestanas.getByRole("link")).toHaveText(["Agenda", "Ajustes"]);
  // La agenda reescribe la dirección al terminar de cargar: se espera a que esté lista antes de salir.
  await expect(page.getByRole("grid").first()).toBeVisible();
  await pestanas.getByRole("link", { name: "Ajustes" }).click();
  await expect(page).toHaveURL(/\/ajustes$/);
  await expect(page.getByRole("heading", { name: "Ayuda", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mi negocio", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
  // Las secciones de adentro siguen protegidas.
  await page.goto("/ajustes/mi-negocio");
  await expect(page).toHaveURL(/\/agenda/);
});

test("desde la tableta, /ajustes sigue llevando a Mi negocio", async ({ page }, info) => {
  test.skip(info.project.name === "celular", "en el celular es el centro");
  await entrarComo(page, "Dueño");
  await page.goto("/ajustes");
  await expect(page).toHaveURL(/\/ajustes\/mi-negocio$/);
});

test("recepción no entra a Administración por la dirección", async ({ page }) => {
  await entrarComo(page, "Recepción");
  await page.goto("/administracion/servicios");
  await expect(page).toHaveURL(/\/agenda/);
  await expect(page.getByText("No tienes permiso para ver esa sección")).toBeVisible();
});

test("sin desplazamiento horizontal", async ({ page }) => {
  await entrarComo(page, "Dueño");
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(ancho).toBeLessThanOrEqual(0);
});
