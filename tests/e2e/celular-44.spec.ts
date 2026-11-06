import { expect, test, type Page } from "@playwright/test";
import { clienteComo } from "../integracion/ayuda";
import { ahoraEnZona } from "../../src/features/agenda/lib/fechas";
import { chicos } from "./ayuda-44";
import { PANTALLAS_DUENO } from "./pantallas";

// Celular primero (DESIGN.md §5): en el celular cada control se toca con un área de 44 × 44 px o más, sea su alto
// real o el `::after` de la utilidad `area-tactil`. Recorre todas las pantallas y la reserva en línea. Solo lee.
// Excepción documentada: las citas, los bloqueos y el «+N más» de la agenda miden lo que duran (`[data-cita]`, `[data-bloqueo]`, `[data-mas]`).

async function abrir(page: Page, ruta: string) {
  await page.goto(ruta);
  await page.waitForLoadState("networkidle");
}

test.beforeEach(({}, info) => {
  test.skip(
    info.project.name !== "celular",
    "las áreas de 44 px son del celular",
  );
});

test("en el celular todos los controles de la app miden 44 px o más", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await abrir(page, "/entrar");
  const malos = await chicos(page, "/entrar");
  await page.getByRole("button", { name: /Dueño/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));
  // Sin el globo de Primeros pasos tapando controles.
  await page.evaluate(() => localStorage.clear());

  for (const ruta of PANTALLAS_DUENO) {
    await abrir(page, ruta);
    malos.push(...(await chicos(page, ruta)));
  }
  expect(malos).toEqual([]);
});

test("en el celular los controles de la reserva en línea miden 44 px o más", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const ruta = "/reservar/salon-ceiba";
  await abrir(page, ruta);
  const malos = await chicos(page, ruta);
  await abrir(page, `${ruta}/mis-citas`);
  malos.push(...(await chicos(page, `${ruta}/mis-citas`)));

  // Los pasos de la reserva, con una selección de verdad (no se envía: solo lee), como en csp.spec.ts.
  await abrir(page, ruta);
  await page.getByRole("button", { name: "Agregar Corte de dama" }).click();
  await page.getByRole("button", { name: "Agendar ahora" }).click();
  await page.waitForURL(/\/hora\?/);
  await page.waitForLoadState("networkidle");
  malos.push(...(await chicos(page, `${ruta}/hora`)));
  const primerDia = page
    .getByRole("group", { name: "Días" })
    .getByRole("button")
    .first();
  const antes = await primerDia.getAttribute("aria-label");
  await page.getByRole("button", { name: "Semana siguiente" }).click();
  await expect(primerDia).not.toHaveAttribute("aria-label", antes ?? "");
  await page.getByRole("button", { name: /^Mar \d+/ }).click();
  await page
    .getByRole("button", { name: /^\d{2}:\d{2}$/ })
    .first()
    .click();
  malos.push(...(await chicos(page, `${ruta}/hora (con hora elegida)`)));
  const siguiente = page
    .getByRole("button", { name: "Siguiente", exact: true })
    .filter({ visible: true });
  await siguiente.click();
  await page.waitForURL(/\/datos\?/);
  await page.waitForLoadState("networkidle");
  malos.push(...(await chicos(page, `${ruta}/datos`)));

  // El enlace personal de una cita que viene (el cliente sin cuenta).
  const recepcion = await clienteComo("recepcion@salonceiba.test");
  const { data: cita } = await recepcion
    .from("citas")
    .select("token")
    .eq("estado", "reservado")
    .gt("fecha", ahoraEnZona().fecha)
    .limit(1)
    .single();
  expect(cita?.token, "una cita reservada en la semilla").toBeTruthy();
  await abrir(page, `/cita/${cita!.token}`);
  malos.push(...(await chicos(page, "/cita/<token>")));
  expect(malos).toEqual([]);
});
