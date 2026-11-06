import { expect, test, type Page } from "@playwright/test";

// Pruebas que cambian datos: solo en computador para no pisarse entre tamaños.
test.describe.configure({ mode: "serial" });

async function entrarComoDuena(page: Page) {
  await page.goto("/entrar");
  await page.getByRole("button", { name: /Dueño/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));
}

test.beforeEach(async ({ page }, info) => {
  test.skip(
    info.project.name !== "computador",
    "flujo de escritura: se prueba en un tamaño",
  );
  await entrarComoDuena(page);
});

test("el horario rechaza un cierre antes de la apertura", async ({ page }) => {
  await page.goto("/administracion/locales");
  await page
    .getByRole("button", { name: "Editar horario de Sede Chapinero" })
    .click();
  await page.getByLabel("Lunes: cierre").fill("08:00");
  await expect(
    page.getByText("La hora de cierre debe ser después de la de apertura"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Guardar horario" }),
  ).toBeDisabled();
});

test("un servicio con duración fuera de rango no se guarda", async ({
  page,
}) => {
  await page.goto("/administracion/servicios");
  await page.getByRole("button", { name: "Nuevo" }).click();
  await page.getByRole("menuitem", { name: "Servicio", exact: true }).click();
  await page.getByLabel("Nombre").fill("Prueba de duración");
  await page.getByLabel("Precio (COP)").fill("10000");
  await page.getByLabel("Duración (minutos)").fill("3");
  await page.getByRole("button", { name: "Crear servicio" }).click();
  await expect(
    page.getByText("La duración debe estar entre 5 y 720 minutos"),
  ).toBeVisible();
});

test("borrar un servicio pide confirmación", async ({ page }) => {
  await page.goto("/administracion/servicios");
  await page
    .getByRole("button", { name: "Más opciones de Corte de dama" })
    .click();
  await page.getByRole("menuitem", { name: "Borrar" }).click();
  const confirmar = page.getByRole("dialog", {
    name: '¿Borrar "Corte de dama"?',
  });
  await expect(confirmar).toBeVisible();
  await confirmar.getByRole("button", { name: "Cancelar" }).click();
  await expect(confirmar).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Más opciones de Corte de dama" }),
  ).toBeVisible();
});

test("ajustes: la barra de cambios aparece y salir pregunta", async ({
  page,
}) => {
  await page.goto("/ajustes/agenda");
  await page.getByRole("switch", { name: "permitirSobrepuestas" }).click();
  await expect(
    page.getByText("Tienes cambios pendientes de guardar"),
  ).toBeVisible();
  await page.getByRole("link", { name: "Caja" }).first().click();
  await expect(page.getByText("¿Salir sin guardar?")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).last().click();
  await page.getByRole("button", { name: "Cancelar" }).first().click();
  await expect(
    page.getByText("Tienes cambios pendientes de guardar"),
  ).toBeHidden();
});

test("invitar un usuario deja la invitación en el buzón", async ({ page }) => {
  // Tres pantallas y dos acciones del servidor: con toda la suite a la vez, 30 s no alcanzan y el usuario de
  // prueba queda en la base (el navegador se cierra a mitad de "Quitar acceso").
  test.setTimeout(60_000);
  const correo = `prueba${Date.now()}@salonceiba.test`;
  await page.goto("/usuarios");
  await page.getByRole("button", { name: "Invitar usuario" }).click();
  await page.getByLabel("Nombre").fill("Usuario de prueba");
  await page.getByLabel("Correo").fill(correo);
  await page.getByRole("button", { name: "Invitar", exact: true }).click();
  await expect(page.getByRole("cell", { name: correo })).toBeVisible();

  await page.goto("/demo/buzon");
  await page
    .getByRole("link", { name: /Usuario de prueba/ })
    .first()
    .click();
  await expect(page.getByText(`<${correo}>`)).toBeVisible();

  await page.goto("/usuarios");
  await page
    .getByRole("button", { name: "Quitar a Usuario de prueba" })
    .click();
  await page.getByRole("button", { name: "Quitar acceso" }).click();
  // Mientras la confirmación se cierra la tabla está aria-hidden: se espera el aviso del servidor.
  await expect(
    page.locator("[data-sonner-toast]").filter({ hasText: "Acceso quitado" }),
  ).toBeVisible();
  await expect(page.getByText(correo)).toHaveCount(0);
});
