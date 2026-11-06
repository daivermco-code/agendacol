import { expect, test, type Page } from "@playwright/test";
import {
  ahoraEnZona,
  moverAncla,
  tituloCorto,
  tituloRango,
} from "../../src/features/agenda/lib/fechas";
import { PANTALLAS_DUENO } from "./pantallas";

// App de celular (Fase 12): lo que solo existe por debajo de 768 px y lo que no debe cambiar desde la tableta.

async function entrarComo(page: Page, rol: RegExp) {
  await page.goto("/entrar");
  await page.getByRole("button", { name: rol }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));
  await page.evaluate(() => localStorage.removeItem("agedacol-agenda"));
}

const hoy = () => ahoraEnZona().fecha;

/** Hoy más n semanas (YYYY-MM-DD). */
function enSemanas(n: number) {
  const d = new Date(`${hoy()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7 * n);
  return d.toISOString().slice(0, 10);
}

/** Desliza el dedo de lado sobre la cuadrícula, rápido (dx < 0: hacia la izquierda). */
async function deslizar(page: Page, dx: number) {
  const caja = await page.getByRole("grid").first().boundingBox();
  if (!caja) throw new Error("No se ve la cuadrícula");
  const y = caja.y + caja.height / 2;
  const x = caja.x + caja.width / 2 - dx / 2;
  const cdp = await page.context().newCDPSession(page);
  const tocar = (type: "touchStart" | "touchMove" | "touchEnd", px: number) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x: px, y }],
    });
  await tocar("touchStart", x);
  for (let i = 1; i <= 4; i++) await tocar("touchMove", x + (dx * i) / 4);
  await tocar("touchEnd", x + dx);
}

/** Arrastra la hoja abierta hacia abajo desde su asa (vaul la sigue con eventos de puntero). */
async function bajarHoja(page: Page) {
  const caja = await page.getByRole("dialog").boundingBox();
  if (!caja) throw new Error("No se ve la hoja");
  const x = caja.x + caja.width / 2;
  const y = caja.y + 8;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 400, { steps: 12 });
  await page.mouse.up();
}

/** Las pestañas del celular: se llega a ellas por la barra, no desde Ajustes. */
const PESTANAS = [
  { nombre: "Inicio", ruta: "/" },
  { nombre: "Agenda", ruta: "/agenda" },
  { nombre: "Clientes", ruta: "/clientes" },
  { nombre: "Ventas", ruta: "/ventas/detalle" },
  { nombre: "Ajustes", ruta: "/ajustes" },
];

test.describe("en el celular", () => {
  test("3 días, deslizar de lado y volver con Hoy", async ({ page }, info) => {
    test.skip(info.project.name !== "celular", "solo en el celular");
    await entrarComo(page, /Recepción/);
    await page.goto("/agenda?vista=3dias");
    const titulo = (ancla: string) =>
      page.getByText(tituloCorto("3dias", ancla), { exact: true });
    await expect(titulo(hoy())).toBeVisible();
    // La columna de horas y los 3 días, sin desplazamiento de lado.
    await expect(page.getByRole("columnheader")).toHaveCount(4);
    const hoyBoton = page.getByRole("button", { name: "Hoy", exact: true });
    await expect(hoyBoton).toHaveCount(0);

    await deslizar(page, -160);
    const despues = moverAncla("3dias", hoy(), 1);
    await expect(titulo(despues)).toBeVisible();
    await expect(hoyBoton).toBeVisible();

    await hoyBoton.click();
    await expect(titulo(hoy())).toBeVisible();
    await expect(hoyBoton).toHaveCount(0);

    await deslizar(page, 160);
    await expect(titulo(moverAncla("3dias", hoy(), -1))).toBeVisible();
  });

  test("la vista se elige en una hoja desde abajo", async ({ page }, info) => {
    test.skip(info.project.name !== "celular", "solo en el celular");
    await entrarComo(page, /Recepción/);
    await page.goto("/agenda");
    await page.getByRole("button", { name: "Vista y opciones" }).click();
    const hoja = page.getByRole("dialog", { name: "Vista" });
    await expect(hoja.getByRole("button", { pressed: true })).toHaveText(
      "Semana",
    );
    for (const v of ["Lista", "Día", "3 días", "Semana", "Mes"]) {
      await expect(
        hoja.getByRole("button", { name: v, exact: true }),
      ).toBeVisible();
    }
    await hoja.getByRole("button", { name: "Mes", exact: true }).click();
    await expect(hoja).toHaveCount(0);
    await expect(page.getByRole("grid", { name: "Mes" })).toBeVisible();
  });

  test("al tocar un hueco sale la hoja ¿Qué quieres agregar?", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "celular", "solo en el celular");
    await entrarComo(page, /Recepción/);
    // Un día sin datos (la semilla llega a 4 semanas adelante): solo se lee.
    await page.goto(`/agenda?vista=dia&fecha=${enSemanas(25)}`);
    await page
      .getByRole("gridcell")
      .first()
      .click({ position: { x: 20, y: 120 } });
    const hoja = page.getByRole("dialog", { name: "¿Qué quieres agregar?" });
    for (const opcion of [
      "Nueva reserva",
      "Clase",
      "Bloquear horario",
      "Nueva venta",
    ]) {
      await expect(hoja.getByRole("button", { name: opcion })).toBeVisible();
    }
    // Tocar dentro de la hoja no debe volver a abrirla (el clic cruza el portal hasta la columna).
    await hoja.getByRole("button", { name: "Cerrar" }).click();
    await expect(hoja).toHaveCount(0);
    await page.waitForTimeout(400);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("cliente y servicio de la reserva se eligen en hojas", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "celular", "solo en el celular");
    await entrarComo(page, /Recepción/);
    // Un día sin datos: solo se lee (la reserva se cancela al final).
    await page.goto(`/agenda?vista=dia&fecha=${enSemanas(25)}`);
    await page
      .getByRole("gridcell")
      .first()
      .click({ position: { x: 20, y: 120 } });
    await page
      .getByRole("dialog", { name: "¿Qué quieres agregar?" })
      .getByRole("button", { name: "Nueva reserva" })
      .click();
    const ventana = page.getByRole("dialog", { name: "Nueva reserva" });
    await expect(ventana).toBeVisible();

    const servicio = ventana.locator("#reserva-servicio");
    // Desde el hueco el profesional ya viene puesto: falta el servicio.
    await expect(servicio).toHaveText("Elige un servicio");
    await ventana
      .locator("#reserva-profesional")
      .selectOption({ label: "Carolina Ruiz" });
    await servicio.click();
    const hojaServicio = page.getByRole("dialog", { name: "Elegir servicio" });
    await expect(
      hojaServicio.getByRole("heading", { name: "Cabello", level: 3 }),
    ).toBeVisible();
    await hojaServicio.getByLabel("Buscar servicio").fill("ceja");
    await expect(
      hojaServicio.getByRole("button").filter({ hasText: "Corte de dama" }),
    ).toHaveCount(0);
    const cejas = hojaServicio
      .getByRole("button")
      .filter({ hasText: "Diseño de cejas" });
    expect((await cejas.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await cejas.click();
    await expect(hojaServicio).toHaveCount(0);
    await expect(servicio).toContainText("Diseño de cejas");
    await expect(servicio).toBeFocused();
    expect((await servicio.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(
      44,
    );

    await ventana.locator("#reserva-cliente").click();
    const hojaCliente = page.getByRole("dialog", { name: "Elegir cliente" });
    await expect(page.locator("#reserva-cliente-buscar")).toBeFocused();
    await expect(
      hojaCliente.getByText("Escribe al menos 2 letras para buscar."),
    ).toBeVisible();
    await expect(
      hojaCliente.getByRole("button", { name: "Crear cliente nuevo" }),
    ).toBeVisible();
    await page.locator("#reserva-cliente-buscar").fill("Carolina Acosta");
    await hojaCliente
      .getByRole("list", { name: "Clientes encontrados" })
      .getByRole("button")
      .filter({ hasText: "Carolina Acosta" })
      .click();
    await expect(hojaCliente).toHaveCount(0);
    await expect(ventana.getByText("Carolina Acosta")).toBeVisible();
    // El botón se cambió por la tarjeta: el foco va a su primer botón, no se pierde.
    await expect(
      ventana.getByRole("button", { name: "Editar contacto del cliente" }),
    ).toBeFocused();

    await ventana.getByRole("button", { name: "Cancelar" }).click();
    await expect(ventana).toHaveCount(0);
  });

  test("buscar en la agenda deja solo esas citas", async ({ page }, info) => {
    test.skip(info.project.name !== "celular", "solo en el celular");
    await entrarComo(page, /Recepción/);
    await page.goto(`/agenda?fecha=${enSemanas(-2)}`);
    const citas = page.locator("[data-cita]");
    await expect(citas.first()).toBeVisible();
    const cliente = (await citas.first().getAttribute("aria-label"))!.split(
      ", ",
    )[0];

    await page.getByRole("button", { name: "Buscar en la agenda" }).click();
    const caja = page.getByRole("searchbox", { name: "Buscar citas" });
    await caja.fill(cliente);
    await expect(
      page.getByRole("status").filter({ hasText: "en estas fechas" }),
    ).toHaveText(/^\d+ citas? en estas fechas$/);
    for (const etiqueta of await citas.evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label") ?? ""),
    ))
      expect(etiqueta.startsWith(`${cliente}, `)).toBe(true);

    await caja.fill("zzzz");
    await expect(
      page.getByRole("status").filter({ hasText: "en estas fechas" }),
    ).toHaveText("0 citas en estas fechas");
    await expect(citas).toHaveCount(0);
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(caja).toHaveCount(0);
    await expect(citas.first()).toBeVisible();
  });

  test("la lista son tarjetas por día que abren la cita", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "celular", "solo en el celular");
    await entrarComo(page, /Recepción/);
    await page.goto(`/agenda?vista=lista&fecha=${enSemanas(-2)}`);
    const tarjeta = page
      .getByRole("button", { name: /^Ver la cita de / })
      .first();
    await expect(tarjeta).toBeVisible();
    await tarjeta.click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("vista Ahora: el equipo en este minuto y reserva rápida", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "celular", "solo en el celular");
    await entrarComo(page, /Dueño/);
    // Reloj fijo: un miércoles de hace 10 semanas (sin citas de la semilla ni de otras pruebas) a las 10:30 de
    // Bogotá. Carolina (descansa a las 13:00), Andrés y Valentina están libres; Julián empieza a las 11:00.
    const d = new Date(`${enSemanas(-10)}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 3 - d.getUTCDay());
    const miercoles = d.toISOString().slice(0, 10);
    await page.clock.setFixedTime(new Date(`${miercoles}T15:30:00Z`));
    await page.goto(`/agenda?vista=dia&fecha=${miercoles}`);
    const grupo = page.getByRole("group", { name: "Día o Ahora" });
    await grupo.getByRole("button", { name: "Ahora" }).click();
    await expect(grupo.getByRole("button", { name: "Ahora" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("grid")).toHaveCount(0);
    // En Ahora no se busca.
    await expect(
      page.getByRole("button", { name: "Buscar en la agenda" }),
    ).toBeHidden();

    const libres = page.getByRole("region", { name: "Libres" });
    await expect(libres.getByRole("listitem")).toHaveCount(3);
    await expect(
      libres.getByRole("listitem", { name: "Carolina Ruiz" }),
    ).toContainText("Libre hasta las 13:00");
    await expect(
      libres.getByRole("listitem", { name: "Andrés Molina" }),
    ).toContainText("Libre el resto del día");
    await expect(
      page
        .getByRole("region", { name: "No disponibles" })
        .getByRole("listitem", { name: "Julián Herrera" }),
    ).toContainText("Empieza a las 11:00");
    await expect(page.getByRole("region", { name: "Atendiendo" })).toHaveCount(
      0,
    );

    await page
      .getByRole("button", { name: "Reserva rápida con Carolina Ruiz" })
      .click();
    const ventana = page.getByRole("dialog", { name: "Nueva reserva" });
    await expect(ventana).toBeVisible();
    await expect(
      ventana.locator("#reserva-profesional option:checked"),
    ).toHaveText("Carolina Ruiz");
    await expect(ventana.locator("#reserva-fecha")).toHaveValue(miercoles);
    await expect(ventana.locator("#reserva-hora")).toHaveValue("10");
    await expect(
      ventana.getByRole("combobox", { name: "Minutos de hora" }),
    ).toHaveValue("30");
    await ventana.getByRole("button", { name: "Cancelar" }).click();
    await expect(ventana).toHaveCount(0);

    await grupo.getByRole("button", { name: "Día" }).click();
    await expect(page.getByRole("grid")).toBeVisible();
  });

  test("Inicio: tablero de tarjetas e historia con las horas libres", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "celular", "solo en el celular");
    // Sin el menú de compartir del celular: la historia se descarga.
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "canShare", { value: undefined }),
    );
    await entrarComo(page, /Dueño/);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /^Hola, / })).toBeVisible();
    for (const tarjeta of [
      "Sugerencia de hoy",
      "Esta semana",
      "Meta del mes",
      "Indicadores",
      "Origen de las reservas",
    ])
      await expect(page.getByRole("region", { name: tarjeta })).toBeVisible();
    const indicadores = page.getByRole("region", { name: "Indicadores" });
    for (const nombre of [
      "Retención",
      "Ingreso estimado",
      "Clientes nuevos",
      "Ticket promedio",
    ])
      await expect(indicadores.getByText(nombre)).toBeVisible();
    // Desde la tableta sigue el Resumen; aquí no.
    await expect(page.getByText("Factor de ocupación")).toBeHidden();

    // La semilla deja horas libres en el próximo día que abre el local.
    const sugerencia = page
      .getByRole("region", { name: "Sugerencia de hoy" })
      .getByRole("button", { name: /horas? libres?/ });
    await sugerencia.click();
    const hoja = page.getByRole("dialog", { name: "Compartir historia" });
    await expect(hoja).toBeVisible();
    const lienzo = hoja.getByRole("img", { name: /^Historia: horas libres / });
    await expect(lienzo).toBeVisible();
    // El canvas tiene dibujo (no está en blanco).
    await expect
      .poll(() =>
        lienzo.evaluate((c) => {
          const ctx = (c as HTMLCanvasElement).getContext("2d")!;
          const { data } = ctx.getImageData(540, 960, 1, 1);
          return data[3];
        }),
      )
      .toBe(255);

    const colores = hoja.getByRole("group", { name: "Color" });
    await expect(colores.getByRole("button")).toHaveCount(7);
    await colores.getByRole("button", { name: "Coral" }).click();
    await expect(
      colores.getByRole("button", { name: "Coral" }),
    ).toHaveAttribute("aria-pressed", "true");
    const estilo = hoja.getByRole("group", { name: "Estilo" });
    await estilo.getByRole("button", { name: "Oscuro" }).click();
    await expect(
      estilo.getByRole("button", { name: "Oscuro" }),
    ).toHaveAttribute("aria-pressed", "true");

    const descarga = page.waitForEvent("download");
    await hoja.getByRole("button", { name: "Descargar" }).click();
    expect((await descarga).suggestedFilename()).toBe("horas-libres.png");

    await hoja.getByRole("button", { name: "Cerrar" }).click();
    await expect(hoja).toHaveCount(0);

    // El color y el estilo se recuerdan en el equipo.
    await sugerencia.click();
    await expect(
      hoja.getByRole("group", { name: "Color" }).getByRole("button", {
        name: "Coral",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await hoja.getByRole("button", { name: "Cerrar" }).click();
  });

  test("Inicio de Recepción: sin stock bajo y con una sola cabecera", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "celular", "solo en el celular");
    await entrarComo(page, /Recepción/);
    await page.goto("/");
    await expect(
      page.getByRole("region", { name: "Meta del mes" }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Stock bajo" })).toHaveCount(
      0,
    );
    // La cabecera de color reemplaza la del logo: un solo Buscar.
    await expect(page.getByRole("link", { name: "Buscar" })).toHaveCount(1);
  });

  test("Avisos: la campana avisa lo nuevo y las fichas filtran", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "celular", "solo en el celular");
    await entrarComo(page, /Dueño/);
    await page.evaluate(() => localStorage.removeItem("agedacol-avisos-visto"));
    await page.goto("/");
    // Sin nada visto en este equipo, la semilla deja avisos nuevos.
    await page.getByRole("link", { name: "Avisos, hay nuevos" }).click();
    await page.waitForURL("**/avisos");
    await expect(page.getByRole("heading", { name: "Avisos" })).toBeVisible();
    await expect(page.getByText(/^\d+ sin leer$/)).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Pestañas" }).getByRole("link", {
        name: "Inicio",
      }),
    ).toHaveAttribute("aria-current", "page");

    const fichas = page.getByRole("group", { name: "Filtrar avisos" });
    const tarjetas = page.getByRole("listitem").getByRole("link");
    await fichas.getByRole("button", { name: "Pagos" }).click();
    await expect(fichas.getByRole("button", { name: "Pagos" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(tarjetas.first()).toBeVisible();
    // textContent junta el "Nuevo: " del lector de pantalla en el mismo renglón.
    for (const t of await tarjetas.allTextContents())
      expect(t).toMatch(/^(Nuevo: )?(Pago|Abono) recibido/);
    await expect(tarjetas.first()).toHaveAttribute(
      "href",
      /^\/ventas\/transacciones\?desde=\d{4}-\d\d-\d\d&hasta=/,
    );
    await fichas.getByRole("button", { name: "Sistema" }).click();
    await expect(
      page.getByRole("link", { name: /Stock bajo|Producto agotado/ }).first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Marcar todo como leído" }).click();
    await expect(page.getByText("Todo leído")).toBeVisible();
    await fichas.getByRole("button", { name: /^No leídos/ }).click();
    await expect(page.getByText("Estás al día")).toBeVisible();

    // Quedó guardado lo visto. Otras pruebas en paralelo pueden crear avisos nuevos: para revisar la campana sin
    // punto, lo visto se pone en el futuro.
    expect(
      await page.evaluate(() => localStorage.getItem("agedacol-avisos-visto")),
    ).toMatch(/^\d{4}-\d\d-\d\dT/);
    await page.evaluate(() =>
      localStorage.setItem(
        "agedacol-avisos-visto",
        new Date(Date.now() + 86_400_000).toISOString(),
      ),
    );
    // Se vuelve con "‹ Inicio" de la cabecera (no la pestaña).
    await page
      .getByRole("link", { name: "Inicio", exact: true })
      .filter({ has: page.locator("svg.lucide-chevron-left") })
      .click();
    await page.waitForURL((url) => url.pathname === "/");
    await expect(
      page.getByRole("link", { name: "Avisos", exact: true }),
    ).toBeVisible();
  });

  test("Avisos de Recepción: con pagos y sin stock; el profesional no entra", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "celular", "solo en el celular");
    await entrarComo(page, /Recepción/);
    await page.goto("/avisos");
    const fichas = page.getByRole("group", { name: "Filtrar avisos" });
    await expect(
      fichas.getByRole("button", { name: "Reservas" }),
    ).toBeVisible();
    // Recepción cobra (ver_ventas): ve los pagos; el stock es de administrar.
    await expect(fichas.getByRole("button", { name: "Pagos" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Stock bajo|Producto agotado/ }),
    ).toHaveCount(0);

    // Con sesión, /entrar manda al inicio: primero se sale.
    await page.context().clearCookies();
    await entrarComo(page, /Profesional · Carolina/);
    await page.goto("/avisos");
    await page.waitForURL((url) => url.pathname === "/agenda");
  });

  test("Ahora es solo del Dueño", async ({ page }, info) => {
    test.skip(info.project.name !== "celular", "solo en el celular");
    await entrarComo(page, /Recepción/);
    await page.goto("/agenda?vista=dia");
    await expect(page.getByRole("grid")).toBeVisible();
    await expect(page.getByRole("group", { name: "Día o Ahora" })).toHaveCount(
      0,
    );
  });

  test("las 5 pestañas abren su pantalla y quedan marcadas", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "celular", "solo en el celular");
    await entrarComo(page, /Dueño/);
    const barra = page.getByRole("navigation", { name: "Pestañas" });
    await expect(barra.getByRole("link")).toHaveCount(PESTANAS.length);
    // Al revés, para que cada toque cambie de pantalla (se entra en Inicio).
    for (const { nombre, ruta } of [...PESTANAS].reverse()) {
      const pestana = barra.getByRole("link", { name: nombre, exact: true });
      await pestana.click();
      await page.waitForURL((url) => url.pathname === ruta);
      await expect(pestana).toHaveAttribute("aria-current", "page");
      await expect(
        page.getByRole("heading", { level: 1 }).first(),
      ).toBeVisible();
    }
  });

  test("desde Ajustes se llega a cada pantalla del dueño", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "celular", "solo en el celular");
    test.setTimeout(180_000);
    await entrarComo(page, /Dueño/);
    // Lo que no es pestaña ni la 404, sin las vistas (`?vista=`) de una misma pantalla. Avisos se abre con la
    // campana de Inicio (su prueba va arriba).
    const fuera = new Set([
      ...PESTANAS.map((p) => p.ruta),
      "/avisos",
      "/esta-no-existe",
    ]);
    const buscadas = [
      ...new Set(PANTALLAS_DUENO.map((r) => r.split("?")[0]!)),
    ].filter((r) => !fuera.has(r));

    // Los enlaces del centro de Ajustes y de lo que abre: Mi negocio lleva a las de configuración, que en el
    // celular se listan en la barra lateral plegada (`aside`).
    const zona = () => page.locator("main, aside");
    const enlaces = async () =>
      zona()
        .locator("a[href]")
        .evaluateAll((as) =>
          as.map((a) => new URL((a as HTMLAnchorElement).href).pathname),
        );
    const donde = new Map<string, string>();
    // El marco llega después del esqueleto de carga: se espera el título antes de leer o mirar los enlaces.
    const abrir = async (ruta: string) => {
      await page.goto(ruta);
      await expect(
        page.getByRole("heading", { level: 1 }).first(),
      ).toBeVisible();
    };
    await abrir("/ajustes");
    for (const r of await enlaces()) donde.set(r, "/ajustes");
    for (const intermedia of [...donde.keys()]) {
      if (!intermedia.startsWith("/ajustes/")) continue;
      await abrir(intermedia);
      for (const r of await enlaces())
        if (!donde.has(r)) donde.set(r, intermedia);
    }
    expect(buscadas.filter((r) => !donde.has(r))).toEqual([]);

    // Y cada enlace abre su pantalla de verdad (sin la página de error).
    for (const ruta of buscadas) {
      await abrir(donde.get(ruta)!);
      const enlace = zona().locator(`a[href="${ruta}"]`).first();
      if (!(await enlace.isVisible()))
        await page.locator('aside button[aria-expanded="false"]').click();
      await enlace.click();
      await page.waitForURL((url) => url.pathname === ruta);
      await expect(
        page.getByRole("heading", { level: 1 }).first(),
      ).toBeVisible();
      await expect(page.getByText("Esta página no existe")).toHaveCount(0);
    }
  });

  test("la ficha de la cita se cierra arrastrando la hoja hacia abajo", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "celular", "solo en el celular");
    await entrarComo(page, /Recepción/);
    // Solo lee: las citas de la semilla de hace dos semanas.
    await page.goto(`/agenda?vista=lista&fecha=${enSemanas(-2)}`);
    await page
      .getByRole("button", { name: /^Ver la cita de / })
      .first()
      .click();
    const hoja = page.getByRole("dialog");
    await expect(hoja).toBeVisible();
    // vaul no deja arrastrar en el primer medio segundo tras abrir (y la hoja aún sube).
    await page.waitForTimeout(700);
    await bajarHoja(page);
    await expect(hoja).toHaveCount(0);
  });

  test("lo que no cabe en los carriles va en +N más", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "celular", "solo en el celular");
    await entrarComo(page, /Recepción/);
    // Semana de todo el local: las citas de los 4 profesionales se pisan.
    await page.goto(`/agenda?fecha=${enSemanas(-2)}`);
    // `isVisible()` no espera: primero sale la pantalla de carga (loading.tsx) y luego la agenda.
    await expect(page.getByRole("grid")).toBeVisible();
    const quitar = page.getByRole("button", { name: /^Quitar filtro / });
    if (await quitar.isVisible()) await quitar.click();
    const mas = page.locator("[data-mas]").first();
    await expect(mas).toBeVisible();
    const n = Number((await mas.textContent())!.match(/\d+/)![0]);
    await mas.click();
    const hoja = page.getByRole("dialog", { name: `${n} más` });
    await expect(hoja.getByRole("listitem")).toHaveCount(n);
    await hoja.getByRole("button", { name: "Cerrar" }).click();
    await expect(hoja).toHaveCount(0);
    await page.waitForTimeout(400);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test("desde la tableta, 3 días se ve como la semana", async ({
  page,
}, info) => {
  test.skip(
    info.project.name === "celular",
    "en el celular es su propia vista",
  );
  await entrarComo(page, /Recepción/);
  await page.goto("/agenda?vista=3dias");
  await expect(
    page.getByText(tituloRango("semana", hoy()), { exact: true }),
  ).toBeVisible();
});

test("desde la tableta no hay interruptor Día / Ahora", async ({
  page,
}, info) => {
  test.skip(info.project.name === "celular", "en el celular sí está");
  await entrarComo(page, /Dueño/);
  await page.goto("/agenda?vista=dia");
  await expect(page.getByRole("grid")).toBeVisible();
  await expect(page.getByRole("group", { name: "Día o Ahora" })).toHaveCount(0);
});

test("desde la tableta no hay +N más: los carriles se reparten todos", async ({
  page,
}, info) => {
  test.skip(info.project.name === "celular", "en el celular hay tope");
  await entrarComo(page, /Recepción/);
  await page.goto(`/agenda?fecha=${enSemanas(-2)}`);
  await expect(page.locator("[data-cita]").first()).toBeVisible();
  await expect(page.locator("[data-mas]")).toHaveCount(0);
});
