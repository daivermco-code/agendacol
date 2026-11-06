import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { ahoraEnZona } from "../../src/features/agenda/lib/fechas";

// Resumen, reporte de reservas con sus pestañas, permiso del reporte de ventas, Exportar (CSV) con «Editar
// columnas» y la búsqueda rápida de hora. Solo leen: no dejan nada en la base.
async function entrarComo(page: Page, rol: RegExp) {
  await page.goto("/entrar");
  await page.getByRole("button", { name: rol }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));
}

test("el Resumen del dueño trae cifras, gráficos y el stock bajo", async ({
  page,
}, info) => {
  await entrarComo(page, /Dueño/);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
  // En el celular, Inicio es el tablero de tarjetas (app-celular.spec); el stock bajo también está.
  if (info.project.name !== "celular") {
    await expect(page.getByText("Factor de ocupación").first()).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Ocupación por día" }),
    ).toBeVisible();
  }
  const stock = page.getByRole("region", { name: "Stock bajo" });
  await expect(stock.getByText("Crema de manos con karité")).toBeVisible();
  await stock.getByRole("link", { name: "Ver el inventario" }).click();
  await expect(page).toHaveURL(/\/administracion\/productos\?bajo=1/);
  await expect(
    page.getByRole("switch", { name: "Solo stock bajo" }),
  ).toBeChecked();
});

test("reporte de reservas: las pestañas guardan el período en la dirección", async ({
  page,
}) => {
  await entrarComo(page, /Recepción/);
  await page.goto("/reportes/reservas?desde=2026-10-01&hasta=2026-10-31");
  const secciones = page.getByRole("navigation", {
    name: "Secciones del reporte",
  });
  await secciones.getByRole("link", { name: "Historial" }).click();
  await expect(page).toHaveURL(/vista=historial/);
  await expect(page).toHaveURL(/desde=2026-10-01/);
  await secciones.getByRole("link", { name: "Rendimiento" }).click();
  await expect(page).toHaveURL(/vista=rendimiento/);
  await expect(
    secciones.getByRole("link", { name: "Rendimiento" }),
  ).toHaveAttribute("aria-current", "page");
});

test("recepción no entra al reporte de ventas", async ({ page }) => {
  await entrarComo(page, /Recepción/);
  await page.goto("/reportes/ventas");
  await expect(page).toHaveURL(/\/agenda\?aviso=sin-permiso/);
});

test("Exportar descarga el CSV con las columnas elegidas", async ({
  page,
}, info) => {
  await entrarComo(page, /Recepción/);
  // Las últimas 4 semanas: el período por defecto (el mes hasta hoy) llega vacío el día 1 de cada mes.
  const hasta = ahoraEnZona().fecha;
  const d = new Date(`${hasta}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 28);
  const desde = d.toISOString().slice(0, 10);
  await page.goto(`/ventas/detalle?desde=${desde}&hasta=${hasta}`);
  if (info.project.name !== "celular") {
    await page.getByRole("button", { name: "Editar columnas" }).click();
    await page.getByRole("menuitemcheckbox", { name: "Pagado" }).click();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("columnheader", { name: "Pagado" }),
    ).toBeVisible();
  }
  const descarga = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exportar" }).click();
  const archivo = await descarga;
  expect(archivo.suggestedFilename()).toMatch(
    /^ventas-\d{4}-\d{2}-\d{2}-a-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  const csv = await readFile(await archivo.path(), "utf8");
  const encabezado = csv.split("\r\n")[0];
  expect(encabezado).toBe(
    info.project.name === "celular"
      ? "﻿ID;Fecha y hora;Monto;Cliente;Método;Estado"
      : "﻿ID;Fecha y hora;Monto;Pagado;Cliente;Método;Estado",
  );
  expect(csv.split("\r\n").length).toBeGreaterThan(3);
});

test("la búsqueda rápida abre la reserva con servicio, profesional y hora", async ({
  page,
}) => {
  await entrarComo(page, /Recepción/);
  await page.goto("/agenda");
  // `isVisible()` no espera: primero la agenda en pantalla.
  await expect(page.getByRole("grid")).toBeVisible();
  const abrir = page.getByRole("button", { name: "Abrir filtros" });
  if (await abrir.isVisible()) await abrir.click();
  await page.getByRole("button", { name: "Búsqueda rápida de hora" }).click();
  const busqueda = page
    .getByRole("dialog")
    .filter({ hasText: "Primera hora libre" });
  await busqueda
    .getByLabel("Servicio")
    .selectOption({ label: "Corte de dama" });
  await busqueda
    .getByLabel("Profesional")
    .selectOption({ label: "Carolina Ruiz" });
  await busqueda.getByRole("button", { name: "Buscar" }).click();
  const horas = busqueda
    .getByRole("list", { name: "Horas libres" })
    .getByRole("button");
  await expect(horas).toHaveCount(6);
  await horas.first().click();
  const reserva = page.getByRole("dialog").filter({ hasText: "Nueva reserva" });
  await expect(reserva).toBeVisible();
  // En el celular el servicio es un botón que abre una hoja (T-12.4) y muestra lo elegido.
  const servicio = reserva.locator("#reserva-servicio");
  const elegido =
    (await servicio.evaluate((n) => n.tagName)) === "SELECT"
      ? servicio.locator("option:checked")
      : servicio;
  await expect(elegido).toHaveText(/Corte de dama/);
  await expect(
    reserva.locator("#reserva-profesional option:checked"),
  ).toHaveText("Carolina Ruiz");
  await reserva.getByRole("button", { name: "Cancelar" }).click();
});
