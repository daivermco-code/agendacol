import { expect, test, type Page } from "@playwright/test";
import { PASOS } from "../../src/features/primeros-pasos/lib/pasos";

// Primeros pasos y la app instalable. Solo lee: no crea datos, así que los 4 tamaños corren a la vez.
// El recorrido va de pantalla en pantalla con `?guia=n`: en cada paso el globo dice "Paso n de 6" y el control que
// señala está a la vista (en celular, el de la agenda es el botón flotante).

async function entrarComo(page: Page, rol: RegExp) {
  await page.goto("/entrar");
  await page.getByRole("button", { name: rol }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));
}

const globo = (page: Page) =>
  page.getByRole("dialog").filter({ hasText: /^Paso \d de 6/ });

test("la lista de Primeros pasos y el recorrido completo por las 6 pantallas", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await entrarComo(page, /Dueño/);
  await page.goto("/primeros-pasos");
  await expect(
    page.getByRole("heading", { name: "Primeros pasos", level: 1 }),
  ).toBeVisible();
  // Con la semilla, los 6 pasos ya están hechos.
  await expect(page.getByText("6 de 6 listos")).toBeVisible();
  await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(6);
  await expect(page.getByText("(listo)")).toHaveCount(6);

  await page.getByRole("link", { name: "Empezar el recorrido" }).click();
  for (const [i, paso] of PASOS.entries()) {
    const n = i + 1;
    await page.waitForURL(new RegExp(`${paso.ruta}\\?(.*&)?guia=${n}`));
    const g = globo(page);
    await expect(g).toBeVisible();
    await expect(g).toContainText(`Paso ${n} de 6`);
    await expect(g.getByRole("heading", { name: paso.titulo })).toBeVisible();
    await expect(
      page.locator(`[data-guia="${paso.clave}"]`).filter({ visible: true }),
    ).toBeInViewport();
    await expect(g.getByRole("button", { name: "Anterior" })).toHaveCount(
      n > 1 ? 1 : 0,
    );
    await g
      .getByRole("button", { name: n === 6 ? "Terminar" : "Siguiente" })
      .click();
  }
  await page.waitForURL(/\/primeros-pasos$/);
});

test("el globo se cierra con Saltar, con Escape y al tocar el control señalado", async ({
  page,
}) => {
  await entrarComo(page, /Dueño/);

  // Saltar quita el globo y el parámetro, sin tocar los demás.
  await page.goto("/ventas/detalle?guia=6");
  await expect(globo(page)).toBeVisible();
  await globo(page).getByRole("button", { name: "Saltar" }).click();
  await expect(globo(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/ventas\/detalle$/);

  // Anterior vuelve al paso de antes; Escape cierra.
  await page.goto("/ajustes/sitio-web?guia=5");
  await globo(page).getByRole("button", { name: "Anterior" }).click();
  await page.waitForURL(/\/agenda\?(.*&)?guia=4/);
  await expect(globo(page)).toContainText("Paso 4 de 6");
  await page.keyboard.press("Escape");
  await expect(globo(page)).toHaveCount(0);

  // Tocar el control hace el paso: se abre su ventana y el globo se va.
  await page.goto("/administracion/profesionales?guia=3");
  await expect(globo(page)).toBeVisible();
  await page.locator('[data-guia="equipo"]').click();
  await expect(
    page.getByRole("dialog", { name: "Nuevo profesional" }),
  ).toBeVisible();
  await expect(globo(page)).toHaveCount(0);
});

test("recepción no ve Primeros pasos ni el recorrido", async ({ page }) => {
  await entrarComo(page, /Recepción/);
  await page.goto("/agenda?guia=4");
  await expect(
    page
      .getByRole("button", { name: "Nuevo" })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(page.getByText("Primeros pasos")).toHaveCount(0);
  await expect(globo(page)).toHaveCount(0);
  await page.goto("/primeros-pasos");
  await page.waitForURL(/\/agenda\?aviso=sin-permiso/);
});

test("la app instalable: manifest, íconos y service worker sin sesión", async ({
  request,
}) => {
  const r = await request.get("/manifest.webmanifest");
  expect(r.status()).toBe(200);
  const manifest = (await r.json()) as {
    name: string;
    display: string;
    start_url: string;
    icons: { src: string; sizes: string; purpose?: string }[];
  };
  expect(manifest).toMatchObject({
    name: "AgendaCol",
    display: "standalone",
    start_url: "/",
  });
  expect(manifest.icons.map((i) => i.sizes)).toEqual(
    expect.arrayContaining(["192x192", "512x512"]),
  );
  expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
  for (const { src } of manifest.icons) {
    const icono = await request.get(src);
    expect(icono.status(), src).toBe(200);
    expect(icono.headers()["content-type"]).toBe("image/png");
  }
  const sw = await request.get("/sw.js", { maxRedirects: 0 });
  expect(sw.status()).toBe(200);
  const codigo = await sw.text();
  // Sin manejador de fetch: rompería la app instalada en Safari de iPhone.
  expect(codigo).not.toContain('"fetch"');
  expect(
    (await request.get("/apple-icon.png", { maxRedirects: 0 })).status(),
  ).toBe(200);
});
