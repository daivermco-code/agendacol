import { expect, test, type Page, type WebSocketRoute } from "@playwright/test";
import { clienteComo } from "../integracion/ayuda";
import {
  ahoraEnZona,
  rangoDeVista,
  tituloCorto,
  tituloRango,
} from "../../src/features/agenda/lib/fechas";

async function entrarComo(page: Page, rol: RegExp) {
  await page.goto("/entrar");
  await page.getByRole("button", { name: rol }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));
  await page.evaluate(() => localStorage.removeItem("agedacol-agenda"));
}

const hoy = () => ahoraEnZona().fecha;
const esCelular = (nombre: string) => nombre === "celular";

/** Una cita reservada o confirmada de Carolina en la semana actual (la que pinta la agenda al abrir). */
async function citaDeCarolina(
  recepcion: Awaited<ReturnType<typeof clienteComo>>,
) {
  const { desde, hasta } = rangoDeVista("semana", hoy());
  const { data: citas } = await recepcion
    .from("citas")
    .select("id, estado, profesional_id, profesionales(nombre)")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .in("estado", ["reservado", "confirmado"])
    .limit(20);
  return citas?.find((c) => c.profesionales?.nombre === "Carolina Ruiz");
}

/** Lee un mensaje de Realtime (Phoenix: arreglo en la versión 2, objeto en la 1). */
function leerMensaje(m: string | Buffer) {
  if (typeof m !== "string") return null;
  try {
    const d: unknown = JSON.parse(m);
    if (Array.isArray(d)) {
      const [, , topic, event, payload] = d as [
        unknown,
        unknown,
        string,
        string,
        { status?: string },
      ];
      return { topic, event, payload };
    }
    return d as { topic: string; event: string; payload: { status?: string } };
  } catch {
    return null;
  }
}

const etiquetaEstado = (estado: string) =>
  new RegExp(estado === "confirmado" ? "Confirmado" : "Reservado");

test("la semana muestra las citas de la profesional elegida", async ({
  page,
}, info) => {
  await entrarComo(page, /Recepción/);
  await page.goto("/agenda");
  await expect(
    page.getByRole("button", { name: "Quitar filtro Carolina Ruiz" }),
  ).toBeVisible();
  await expect(page.locator("[data-cita]").first()).toBeVisible();
  const titulo = esCelular(info.project.name)
    ? tituloCorto("semana", hoy())
    : tituloRango("semana", hoy());
  await expect(page.getByText(titulo, { exact: true })).toBeVisible();
});

test("con todos los profesionales se pintan más de 60 citas en menos de 1 s", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "computador", "medida en un tamaño");
  await entrarComo(page, /Recepción/);
  await page.goto("/agenda");
  await expect(page.locator("[data-cita]").first()).toBeVisible();
  const inicio = Date.now();
  await page
    .getByRole("button", { name: "Quitar filtro Carolina Ruiz" })
    .click();
  await expect
    .poll(() => page.locator("[data-cita]").count())
    .toBeGreaterThanOrEqual(60);
  expect(Date.now() - inicio).toBeLessThan(1000);
  await expect(
    page
      .getByText("Sede Chapinero · Todos los profesionales")
      .filter({ visible: true }),
  ).toBeVisible();
});

test("anterior, siguiente y Hoy cambian la semana", async ({ page }, info) => {
  test.skip(
    esCelular(info.project.name),
    "en celular los controles están plegados",
  );
  await entrarComo(page, /Recepción/);
  await page.goto("/agenda");
  const actual = tituloRango("semana", hoy());
  await expect(page.getByText(actual, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(page.getByText(actual, { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Hoy", exact: true }).click();
  await expect(page.getByText(actual, { exact: true })).toBeVisible();
});

test("día por profesional, mes y lista", async ({ page }, info) => {
  await entrarComo(page, /Recepción/);
  await page.goto("/agenda?vista=dia");
  for (const nombre of [
    "Carolina Ruiz",
    "Andrés Molina",
    "Valentina Ospina",
    "Julián Herrera",
  ]) {
    await expect(
      page.getByRole("columnheader", { name: nombre }),
    ).toBeVisible();
  }
  await page.goto("/agenda?vista=mes");
  await expect(page.getByRole("grid", { name: "Mes" })).toBeVisible();
  await page.goto("/agenda?vista=lista");
  // En el celular la lista son tarjetas por día (T-12.6), sin el selector de agrupación.
  await expect(
    info.project.name === "celular"
      ? page.getByRole("button", { name: "Días anteriores" })
      : page.getByRole("button", { name: "Agrupada por día" }),
  ).toBeVisible();
});

test("la vista elegida se recuerda al volver", async ({ page }) => {
  await entrarComo(page, /Recepción/);
  await page.goto("/agenda?vista=mes");
  await expect(page.getByRole("grid", { name: "Mes" })).toBeVisible();
  await page.goto("/agenda");
  await expect(page.getByRole("grid", { name: "Mes" })).toBeVisible();
});

test("la profesional solo ve su columna y no puede quitar su filtro", async ({
  page,
}) => {
  await entrarComo(page, /Profesional · Carolina/);
  await page.goto("/agenda?vista=dia");
  await expect(
    page.getByRole("columnheader", { name: "Carolina Ruiz" }),
  ).toBeVisible();
  // Una sola columna de profesional (la otra cabecera es la de las horas).
  await expect(
    page.getByRole("columnheader").filter({ hasNotText: "Horas" }),
  ).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Quitar filtro/ })).toHaveCount(
    0,
  );
  await expect(
    page.getByText("Comparte tu enlace y recibe reservas"),
  ).toHaveCount(0);
});

test("un hueco ofrece Reserva y Bloquear horario", async ({ page }, info) => {
  test.skip(info.project.name !== "computador", "con ratón");
  await entrarComo(page, /Recepción/);
  await page.goto("/agenda");
  const domingo = page.getByRole("gridcell").last();
  const caja = await domingo.boundingBox();
  if (!caja) throw new Error("sin columna");
  // Al pie del día: arriba, un domingo, está la cita de las 6:00 que crea ventas.spec para hoy.
  await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height - 10);
  await expect(page.getByRole("menuitem", { name: "Reserva" })).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Bloquear horario" }),
  ).toBeVisible();
});

test("en celular la semana se desliza y hay botón +", async ({
  page,
}, info) => {
  test.skip(!esCelular(info.project.name), "solo celular");
  await entrarComo(page, /Recepción/);
  await page.goto("/agenda");
  await expect(page.locator("[data-cita]").first()).toBeVisible();
  const desliza = await page
    .getByRole("grid")
    .evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(desliza).toBe(true);
  // Los días se ven enteros: ninguno queda cortado contra la columna de horas ni contra el borde.
  const cortados = await page.getByRole("grid").evaluate((el) => {
    const g = el.getBoundingClientRect();
    const izq = g.left + 45;
    return [...el.querySelectorAll<HTMLElement>("[role=gridcell]")].filter(
      (c) => {
        const r = c.getBoundingClientRect();
        const visible = r.right > izq + 1 && r.left < g.right - 1;
        return visible && (r.left < izq - 1 || r.right > g.right + 1);
      },
    ).length;
  });
  expect(cortados).toBe(0);
  await expect(page.getByRole("button", { name: "Nuevo" })).toBeVisible();
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(ancho).toBeLessThanOrEqual(page.viewportSize()?.width ?? 390);
});

test("un cambio hecho en otra sesión aparece en menos de 2 s", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "computador", "una vez basta");
  await entrarComo(page, /Recepción/);
  await page.goto("/agenda");
  await expect(page.locator("[data-cita]").first()).toBeVisible();
  const recepcion = await clienteComo("recepcion@salonceiba.test");
  const cita = await citaDeCarolina(recepcion);
  test.skip(!cita, "la semana no tiene citas futuras de Carolina");
  if (!cita) return;
  const nuevo = cita.estado === "reservado" ? "confirmado" : "reservado";
  const bloque = page.locator(`[data-cita="${cita.id}"]`);
  await page.waitForTimeout(800); // deja que el canal en vivo termine de suscribirse
  try {
    await recepcion.from("citas").update({ estado: nuevo }).eq("id", cita.id);
    await expect(bloque).toHaveAttribute(
      "aria-label",
      new RegExp(nuevo === "confirmado" ? "Confirmado" : "Reservado"),
      {
        timeout: 2000,
      },
    );
  } finally {
    await recepcion
      .from("citas")
      .update({ estado: cita.estado })
      .eq("id", cita.id);
  }
});

/**
 * Se pone entre la página y Realtime: con `tragar` se pierden los avisos de cambios (como en un tope o un corte),
 * `uniones` cuenta las veces que el canal de la agenda quedó suscrito y `sockets` permite cortarlos.
 */
async function intervenirRealtime(page: Page) {
  const estado = { tragar: false, uniones: 0, sockets: [] as WebSocketRoute[] };
  await page.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
    const servidor = ws.connectToServer();
    ws.onMessage((m) => servidor.send(m));
    servidor.onMessage((m) => {
      const d = leerMensaje(m);
      if (estado.tragar && d?.event === "postgres_changes") return;
      if (
        d?.event === "phx_reply" &&
        d.topic.startsWith("realtime:agenda-") &&
        d.payload.status === "ok"
      )
        estado.uniones += 1;
      ws.send(m);
    });
    estado.sockets.push(ws);
  });
  return estado;
}

/** Abre la agenda con Realtime intervenido y cambia de estado una cita de Carolina sin que llegue el aviso. */
async function cambioSinAviso(page: Page) {
  const rt = await intervenirRealtime(page);
  // Pedidos de la agenda: al unirse, el canal la vuelve a pedir (use-agenda.ts) y ese pedido puede leer ya el
  // cambio de la prueba si se hace antes de que termine.
  const agenda = { pedidos: 0, terminados: 0 };
  const esAgenda = (r: { url(): string }) =>
    r.url().includes("/rpc/agenda_citas");
  page.on("request", (r) => void (esAgenda(r) && agenda.pedidos++));
  page.on("requestfinished", (r) => void (esAgenda(r) && agenda.terminados++));
  page.on("requestfailed", (r) => void (esAgenda(r) && agenda.terminados++));
  await entrarComo(page, /Recepción/);
  await page.goto("/agenda");
  await expect(page.locator("[data-cita]").first()).toBeVisible();
  const recepcion = await clienteComo("recepcion@salonceiba.test");
  const cita = await citaDeCarolina(recepcion);
  test.skip(!cita, "la semana no tiene citas futuras de Carolina");
  if (!cita) throw new Error("sin cita");
  const nuevo = cita.estado === "reservado" ? "confirmado" : "reservado";
  const bloque = page.locator(`[data-cita="${cita.id}"]`);
  await expect.poll(() => rt.uniones).toBeGreaterThanOrEqual(1);
  // La carga inicial más la que pide el canal al unirse, y ninguna en curso.
  await expect
    .poll(() => agenda.pedidos >= 2 && agenda.terminados === agenda.pedidos)
    .toBe(true);
  const devolver = async () => {
    await recepcion
      .from("citas")
      .update({ estado: cita.estado })
      .eq("id", cita.id);
  };
  rt.tragar = true;
  try {
    await recepcion.from("citas").update({ estado: nuevo }).eq("id", cita.id);
    // El aviso no llega: la agenda sigue con el estado viejo.
    await page.waitForTimeout(1500);
    await expect(bloque).toHaveAttribute(
      "aria-label",
      etiquetaEstado(cita.estado),
    );
  } catch (e) {
    await devolver();
    throw e;
  }
  return { rt, bloque, nuevo, devolver };
}

test("lo que cambia con el canal en vivo caído aparece al reconectarse", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "computador", "una vez basta");
  const { rt, bloque, nuevo, devolver } = await cambioSinAviso(page);
  try {
    // Se corta el socket (4000: un cierre con 1000 no se reconecta) y realtime-js vuelve a unirse solo.
    rt.tragar = false;
    const antes = rt.uniones;
    for (const ws of rt.sockets)
      await ws.close({ code: 4000, reason: "corte" });
    await expect
      .poll(() => rt.uniones, { timeout: 10_000 })
      .toBeGreaterThan(antes);
    await expect(bloque).toHaveAttribute("aria-label", etiquetaEstado(nuevo), {
      timeout: 3000,
    });
  } finally {
    await devolver();
  }
});

test("con avisos perdidos y el canal arriba, la agenda se pone al día en un minuto", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "computador", "una vez basta");
  // Reloj de la página bajo control para adelantar el minuto; el tiempo sigue corriendo normal hasta entonces.
  await page.clock.install();
  const { rt, bloque, nuevo, devolver } = await cambioSinAviso(page);
  try {
    // Como en el tope de Realtime: el canal sigue suscrito y los avisos no llegan.
    const antes = rt.uniones;
    await page.clock.fastForward(61_000);
    await expect(bloque).toHaveAttribute("aria-label", etiquetaEstado(nuevo), {
      timeout: 3000,
    });
    expect(rt.uniones).toBe(antes);
  } finally {
    await devolver();
  }
});
