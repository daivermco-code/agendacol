import { expect, test, type Locator, type Page } from "@playwright/test";
import { clienteServicio, NEGOCIO_DEMO } from "../integracion/ayuda";

// Fotos con next/image: se sube una al servicio desde Administración y se ve en el sitio público; con una foto del
// Storage puesta a mano, se ven también la portada, el logo y el avatar de la agenda. Cambia datos que todos ven:
// solo en computador y en serie, y al final todo vuelve como estaba.
test.describe.configure({ mode: "serial" });

const SERVICIO = "Fotos E2E";
const CAROLINA = "b0000000-0000-4000-8000-000000000001";
const LOCAL = "a1000000-0000-4000-8000-000000000001"; // Sede Chapinero, la del sitio público
const PROFESIONAL = "b0000000-0000-4000-8000-000000000004"; // Julián Herrera
const BUCKET = "servicios";
const RUTA_FOTOS = `/storage/v1/object/public/${BUCKET}/`;

/** PNG de 240 × 240 hecho en el navegador (el formulario pide al menos 200 × 200). */
async function pngDePrueba(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const lienzo = document.createElement("canvas");
    lienzo.width = 240;
    lienzo.height = 240;
    const ctx = lienzo.getContext("2d");
    if (!ctx) throw new Error("Sin canvas");
    ctx.fillStyle = "#0f766e";
    ctx.fillRect(0, 0, 240, 240);
    ctx.fillStyle = "#fde68a";
    ctx.fillRect(60, 60, 120, 120);
    return lienzo.toDataURL("image/png").split(",")[1];
  });
  return Buffer.from(base64, "base64");
}

/** La imagen terminó de cargar con su archivo real (no rota) y salió de next/image. */
async function esperarCargada(imagen: Locator) {
  await imagen.scrollIntoViewIfNeeded();
  await expect(imagen).toHaveAttribute("data-nimg", /.+/);
  await expect
    .poll(() =>
      imagen.evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
    )
    .toBe(true);
}

/** Avisos de CSP y fotos que respondieron con error (p. ej. un 400 de /_next/image). */
function vigilarFotos(page: Page) {
  const problemas: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy/i.test(m.text())) problemas.push(m.text());
  });
  page.on("response", (r) => {
    const url = r.url();
    if (
      (url.includes("/_next/image") || url.includes(RUTA_FOTOS)) &&
      r.status() >= 400
    )
      problemas.push(`${r.status()} ${url}`);
  });
  return problemas;
}

/** Borra el servicio de la prueba (y sus profesionales) si quedó de una corrida anterior o al terminar. */
async function borrarServicioDePrueba() {
  const servicio = clienteServicio();
  const { data } = await servicio
    .from("servicios")
    .select("id")
    .eq("negocio_id", NEGOCIO_DEMO)
    .eq("nombre", SERVICIO);
  const ids = (data ?? []).map((s) => s.id);
  if (!ids.length) return;
  await servicio.from("servicio_profesional").delete().in("servicio_id", ids);
  const { error } = await servicio.from("servicios").delete().in("id", ids);
  if (error)
    throw new Error(`No se pudo borrar "${SERVICIO}": ${error.message}`);
}

async function entrarComoDuena(page: Page) {
  await page.goto("/entrar");
  await page.getByRole("button", { name: /Dueño/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));
}

/** Cambia fotos que ven todos: se prueba en un tamaño. */
function soloEnComputador() {
  test.skip(
    test.info().project.name !== "computador",
    "cambia fotos que ven todos: se prueba en un tamaño",
  );
}

test("una foto subida al servicio se ve en Administración y en el sitio público", async ({
  page,
}) => {
  soloEnComputador();
  const servicio = clienteServicio();
  // Un servicio propio: guardar uno de la semilla reescribe sus profesionales y por un momento sale del sitio
  // público, donde otras pruebas reservan al mismo tiempo.
  await borrarServicioDePrueba();
  const { data: base } = await servicio
    .from("servicios")
    .select("categoria_id")
    .eq("negocio_id", NEGOCIO_DEMO)
    .eq("nombre", "Corte de dama")
    .single();
  if (!base) throw new Error("Faltan datos de la semilla: npm run db:reset");
  const { data: nuevo, error } = await servicio
    .from("servicios")
    .insert({
      negocio_id: NEGOCIO_DEMO,
      categoria_id: base.categoria_id,
      nombre: SERVICIO,
      precio: 30000,
      duracion_min: 30,
      orden: 99,
    })
    .select("id")
    .single();
  if (!nuevo)
    throw new Error(`No se pudo crear el servicio: ${error?.message}`);
  await servicio
    .from("servicio_profesional")
    .insert({ servicio_id: nuevo.id, profesional_id: CAROLINA });
  const { data: previos } = await servicio.storage
    .from(BUCKET)
    .list(NEGOCIO_DEMO, { limit: 1000 });
  const yaEstaban = new Set((previos ?? []).map((f) => f.name));

  const problemas = vigilarFotos(page);
  try {
    await entrarComoDuena(page);
    await page.goto("/administracion/servicios");
    await page
      .getByRole("button", { name: `Editar ${SERVICIO}`, exact: true })
      .click();
    const ventana = page.getByRole("dialog", { name: "Editar servicio" });
    await ventana.locator('input[type="file"]').setInputFiles({
      name: "foto-e2e.png",
      mimeType: "image/png",
      buffer: await pngDePrueba(page),
    });
    const miniatura = ventana.locator(`img[src*="${BUCKET}"]`);
    await expect(miniatura).toHaveCount(1);
    await esperarCargada(miniatura);
    await ventana.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(
      page.locator("[data-sonner-toast]", { hasText: "Cambios guardados" }),
    ).toBeVisible();

    const { data: guardado } = await servicio
      .from("servicios")
      .select("imagenes")
      .eq("id", nuevo.id)
      .single();
    expect(guardado?.imagenes).toHaveLength(1);
    const url = guardado?.imagenes[0] ?? "";

    // En el sitio público la tarjeta del servicio muestra esa foto (directa o pasada por /_next/image).
    await page.goto("/reservar/salon-ceiba");
    const foto = page
      .locator("article")
      .filter({
        has: page.getByRole("heading", { name: SERVICIO, exact: true }),
      })
      .locator("img");
    await expect(foto).toHaveCount(1);
    const src = (await foto.getAttribute("src")) ?? "";
    expect(
      src === url || new URL(src, page.url()).searchParams.get("url") === url,
    ).toBe(true);
    await esperarCargada(foto);
    expect(problemas).toEqual([]);
  } finally {
    await borrarServicioDePrueba();
    // Lo que subió la prueba, guardado o no (si se cortó antes de guardar).
    const { data: ahora } = await servicio.storage
      .from(BUCKET)
      .list(NEGOCIO_DEMO, { limit: 1000 });
    const subidas = (ahora ?? [])
      .filter((f) => !yaEstaban.has(f.name))
      .map((f) => `${NEGOCIO_DEMO}/${f.name}`);
    if (subidas.length) await servicio.storage.from(BUCKET).remove(subidas);
  }
});

test("la portada, el logo y la foto del profesional se ven con next/image", async ({
  page,
}) => {
  soloEnComputador();
  const servicio = clienteServicio();
  const [{ data: negocio }, { data: local }, { data: pro }] = await Promise.all(
    [
      servicio
        .from("negocios")
        .select("logo_url")
        .eq("id", NEGOCIO_DEMO)
        .single(),
      servicio.from("locales").select("portada_url").eq("id", LOCAL).single(),
      servicio
        .from("profesionales")
        .select("foto_url")
        .eq("id", PROFESIONAL)
        .single(),
    ],
  );
  if (!negocio || !local || !pro)
    throw new Error("Faltan datos de la semilla: npm run db:reset");

  const archivo = `${NEGOCIO_DEMO}/e2e-fotos-${test.info().workerIndex}-${Date.now()}.png`;
  await page.goto("/entrar");
  const { error } = await servicio.storage
    .from(BUCKET)
    .upload(archivo, await pngDePrueba(page), { contentType: "image/png" });
  if (error)
    throw new Error(`No se pudo subir la foto de prueba: ${error.message}`);
  const url = servicio.storage.from(BUCKET).getPublicUrl(archivo)
    .data.publicUrl;

  const problemas = vigilarFotos(page);
  try {
    await Promise.all([
      servicio
        .from("negocios")
        .update({ logo_url: url })
        .eq("id", NEGOCIO_DEMO),
      servicio.from("locales").update({ portada_url: url }).eq("id", LOCAL),
      servicio
        .from("profesionales")
        .update({ foto_url: url })
        .eq("id", PROFESIONAL),
    ]);

    // Sitio público, en computador y en celular: portada sin carga diferida (es la imagen principal) y el logo
    // en la cabecera y sobre la portada.
    for (const tamano of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(tamano);
      await page.goto("/reservar/salon-ceiba");
      const portada = page.locator('img[data-nimg="fill"]');
      await expect(portada).toHaveCount(1);
      await expect(portada).toHaveAttribute("loading", "eager");
      await expect(portada).toHaveAttribute("fetchpriority", "high");
      await esperarCargada(portada);
      const logos = page.locator(
        'img[data-nimg="1"][width="32"], img[data-nimg="1"][width="88"]',
      );
      await expect(logos).toHaveCount(2);
      for (const logo of await logos.all()) await esperarCargada(logo);
    }

    // Agenda del día: el avatar de Julián en la cabecera de su columna.
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrarComoDuena(page);
    await page.goto("/agenda?vista=dia");
    const avatar = page.locator('img[data-nimg="1"][width="28"]');
    await expect(avatar.first()).toBeVisible();
    await esperarCargada(avatar.first());
    expect(problemas).toEqual([]);
  } finally {
    const restaurado = await Promise.all([
      servicio
        .from("negocios")
        .update({ logo_url: negocio.logo_url })
        .eq("id", NEGOCIO_DEMO),
      servicio
        .from("locales")
        .update({ portada_url: local.portada_url })
        .eq("id", LOCAL),
      servicio
        .from("profesionales")
        .update({ foto_url: pro.foto_url })
        .eq("id", PROFESIONAL),
    ]);
    const fallo = restaurado.find((r) => r.error)?.error;
    // Si algo no volvió como estaba, la foto se deja: borrarla dejaría una imagen rota en la demo.
    if (fallo)
      throw new Error(`No se pudieron devolver las fotos: ${fallo.message}`);
    await servicio.storage.from(BUCKET).remove([archivo]);
  }
});
