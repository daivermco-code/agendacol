import { expect, test, type Page } from "@playwright/test";
import { clienteComo } from "../integracion/ayuda";
import { ahoraEnZona } from "../../src/features/agenda/lib/fechas";
import { PANTALLAS_DUENO } from "./pantallas";

// La Content-Security-Policy no bloquea nada de la app: recorre todas las pantallas (bajando hasta el final, para
// que se dibujen los gráficos y carguen las fotos) y falla si el navegador avisa de un bloqueo. Solo leen.
const SLUG = "salon-ceiba";

/** Junta los avisos de CSP de la consola mientras dure la prueba. */
function vigilarBloqueos(page: Page): string[] {
  const bloqueos: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy/i.test(m.text()))
      bloqueos.push(`${page.url()} → ${m.text()}`);
  });
  return bloqueos;
}

/** Revisa que la pantalla abierta sea la pedida (sin redirigir) y baje hasta el final. */
async function bajar(page: Page, ruta: string) {
  expect(new URL(page.url()).pathname, ruta).toBe(ruta.split("?")[0]);
  await page.waitForLoadState("networkidle");
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(150);
  }
  await page.waitForLoadState("networkidle");
}

/** Abre la pantalla, revisa que traiga la CSP con nonce y la recorre. */
async function recorrer(page: Page, ruta: string) {
  const respuesta = await page.goto(ruta);
  const csp = respuesta?.headers()["content-security-policy"] ?? "";
  expect(csp, ruta).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  await bajar(page, ruta);
}

test.beforeEach(({}, info) => {
  // El tamaño no cambia la política: basta un computador y un celular.
  test.skip(
    info.project.name.startsWith("tableta"),
    "la CSP es la misma en todos los tamaños",
  );
});

test("la app del dueño no tiene bloqueos de la CSP", async ({ page }) => {
  test.setTimeout(180_000);
  const bloqueos = vigilarBloqueos(page);
  await recorrer(page, "/entrar");
  await page.getByRole("button", { name: /Dueño/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));

  for (const ruta of PANTALLAS_DUENO) await recorrer(page, ruta);

  // Una ficha de cliente.
  await page.goto("/clientes");
  const ficha = await page
    .locator('a[href^="/clientes/"]')
    .evaluateAll((enlaces) =>
      enlaces
        .map((a) => a.getAttribute("href") ?? "")
        .find((h) => /^\/clientes\/[0-9a-f]{8}-/.test(h)),
    );
  expect(ficha, "una ficha de cliente en la lista").toBeTruthy();
  await recorrer(page, ficha!);

  expect(bloqueos).toEqual([]);
});

test("el sitio de reservas no tiene bloqueos de la CSP", async ({ page }) => {
  test.setTimeout(60_000);
  const bloqueos = vigilarBloqueos(page);
  await recorrer(page, `/reservar/${SLUG}`);
  await recorrer(page, `/reservar/${SLUG}/mis-citas`);

  // Los pasos de la reserva, con una selección de verdad (no se envía: solo lee).
  await page.goto(`/reservar/${SLUG}`);
  await page.getByRole("button", { name: "Agregar Corte de dama" }).click();
  await page.getByRole("button", { name: "Agendar ahora" }).click();
  await page.waitForURL(/\/hora\?/);
  await bajar(page, `/reservar/${SLUG}/hora`);
  // El martes de la semana siguiente (lejos de hoy, con horas libres en la semilla).
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
  const siguiente = page
    .getByRole("button", { name: "Siguiente", exact: true })
    .filter({ visible: true });
  await expect(siguiente).toBeEnabled();
  await siguiente.click();
  await page.waitForURL(/\/datos\?/);
  await bajar(page, `/reservar/${SLUG}/datos`);

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
  await recorrer(page, `/cita/${cita!.token}`);

  expect(bloqueos).toEqual([]);
});

test("una ruta de la app terminada en .png también lleva la CSP", async ({
  request,
}) => {
  const respuesta = await request.get("/clientes/x.png", { maxRedirects: 0 });
  expect(respuesta.headers()["content-security-policy"]).toMatch(/'nonce-/);
});

test("el nonce cambia en cada pedido", async ({ request }) => {
  const nonce = async () =>
    (await request.get("/entrar"))
      .headers()
      ["content-security-policy"]?.match(/'nonce-([^']+)'/)?.[1];
  const [a, b] = [await nonce(), await nonce()];
  expect(a).toBeTruthy();
  expect(a).not.toBe(b);
});
