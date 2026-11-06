import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { clienteAnonimo, clienteComo } from "../integracion/ayuda";
import { ahoraEnZona } from "../../src/features/agenda/lib/fechas";
import { diaCorto } from "../../src/features/reserva-publica/lib/fechas-publicas";

// Reserva en línea de punta a punta: el cliente sin cuenta reserva, el buzón responde por él, cambia la hora,
// cancela y califica; la agenda del profesional lo ve en vivo. Cada tamaño usa su profesional y su día de
// la semana (en 2 y 3 semanas: lejos de las fechas de las otras pruebas), así los 4 corren a la vez.
type Cliente = SupabaseClient<Database>;

interface Caso {
  pro: string;
  servicio: string;
  /** Día de la semana ISO (1 = lunes). */
  diaSemana: number;
}

const SLUG = "salon-ceiba";
const CASOS: Record<string, Caso> = {
  computador: { pro: "Carolina Ruiz", servicio: "Corte de dama", diaSemana: 2 },
  "tableta-horizontal": {
    pro: "Andrés Molina",
    servicio: "Corte de caballero",
    diaSemana: 3,
  },
  "tableta-vertical": {
    pro: "Valentina Ospina",
    servicio: "Manicure tradicional",
    diaSemana: 4,
  },
  celular: {
    pro: "Julián Herrera",
    servicio: "Arreglo de barba",
    diaSemana: 5,
  },
};
const TELEFONOS: Record<string, string> = {
  computador: "+573997770001",
  "tableta-horizontal": "+573997770002",
  "tableta-vertical": "+573997770003",
  celular: "+573997770004",
};

let caso: Caso;
let proyecto: string;
let apellido: string;
let recepcion: Cliente;
const abiertos: BrowserContext[] = [];

/** El día `diaSemana` de dentro de `semanas` semanas (en la zona del negocio). */
function diaDentroDe(semanas: number): string {
  const hoy = new Date(`${ahoraEnZona().fecha}T12:00:00Z`);
  const lunes = hoy.getUTCDate() - ((hoy.getUTCDay() + 6) % 7);
  hoy.setUTCDate(lunes + semanas * 7 + caso.diaSemana - 1);
  return hoy.toISOString().slice(0, 10);
}

async function limpiar() {
  const { data: clientes } = await recepcion
    .from("clientes")
    .select("id")
    .eq("apellido", apellido);
  const ids = (clientes ?? []).map((c) => c.id);
  if (!ids.length) return;
  await recepcion.from("citas").delete().in("cliente_id", ids);
  await recepcion.from("clientes").delete().in("id", ids);
}

test.beforeAll(async ({}, info) => {
  proyecto = info.project.name;
  const elegido = CASOS[proyecto];
  if (!elegido) throw new Error(`Sin caso para ${proyecto}`);
  caso = elegido;
  apellido = `Público ${proyecto}`;
  recepcion = await clienteComo("recepcion@salonceiba.test");
  await limpiar();
});

test.afterEach(async () => {
  await Promise.all(abiertos.splice(0).map((c) => c.close()));
});

test.afterAll(async () => {
  await limpiar();
});

/** Otra ventana del mismo tamaño (otra persona: sin la sesión de la primera). */
async function otraVentana(browser: Browser, info: TestInfo): Promise<Page> {
  const { viewport, hasTouch, isMobile, userAgent, deviceScaleFactor } =
    info.project.use;
  const contexto = await browser.newContext({
    baseURL: info.project.use.baseURL,
    locale: "es-CO",
    timezoneId: "America/Bogota",
    viewport,
    hasTouch,
    isMobile,
    userAgent,
    deviceScaleFactor,
  });
  abiertos.push(contexto);
  return contexto.newPage();
}

async function entrarComo(page: Page, rol: RegExp) {
  await page.goto("/entrar");
  await page.getByRole("button", { name: rol }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));
  await page.evaluate(() => localStorage.removeItem("agedacol-agenda"));
}

const aviso = (page: Page, texto: string) =>
  page.locator("[data-sonner-toast]").filter({ hasText: texto });

/** En la tira de 7 días, avanza de semana hasta ver el día y lo elige. */
async function irAlDia(zona: Page | Locator, fecha: string) {
  const { semana, numero } = diaCorto(fecha);
  const dia = zona.getByRole("button", {
    name: new RegExp(`^${semana} ${numero}(,|$)`),
  });
  const primero = zona
    .getByRole("group", { name: "Días" })
    .getByRole("button")
    .first();
  await expect(primero).toBeVisible();
  for (let i = 0; i < 9 && !(await dia.isVisible()); i++) {
    // Solo el día («Jue 5»): la etiqueta también cambia al terminar de cargar («Jue 5, sin horas libres»), y
    // eso no es otra semana; si cuenta, se adelanta un clic y se salta el día.
    const antes = (await primero.getAttribute("aria-label"))?.split(",")[0];
    await zona.getByRole("button", { name: "Semana siguiente" }).click();
    await expect(primero).not.toHaveAttribute(
      "aria-label",
      new RegExp(`^${antes}(,|$)`),
    );
  }
  await dia.click();
}

/** Elige una hora libre del día (la primera, o la última distinta de `evitar`) y la devuelve. */
async function elegirHora(zona: Page | Locator, evitar?: string) {
  let horas = zona.locator("fieldset button");
  if (evitar) horas = horas.filter({ hasNotText: evitar });
  const boton = evitar ? horas.last() : horas.first();
  await expect(boton).toBeVisible();
  const hora = (await boton.textContent())?.trim() ?? "";
  await boton.click();
  return hora;
}

test("reserva en línea, respuesta en el buzón, cambio y cancelación en vivo", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(120_000);
  const dia = diaDentroDe(2);

  // El cliente, sin cuenta, reserva desde el sitio público.
  const web = await otraVentana(browser, info);
  await web.goto(`/reservar/${SLUG}`);
  await web.getByRole("button", { name: `Agregar ${caso.servicio}` }).click();
  await web.getByRole("button", { name: "Agendar ahora" }).click();
  await web.waitForURL(/\/hora\?/);
  await web.getByRole("radio", { name: caso.pro }).click();
  await irAlDia(web, dia);
  const hora = await elegirHora(web);
  await web
    .getByRole("button", { name: "Siguiente", exact: true })
    .filter({ visible: true })
    .click();
  await web.waitForURL(/\/datos\?/);
  await web.getByLabel("Nombre").fill("Ensayo");
  await web.getByLabel("Apellido").fill(apellido);
  await web.getByLabel("Correo").fill(`publico.${proyecto}@ejemplo.test`);
  await web.getByLabel("Teléfono").fill(TELEFONOS[proyecto]);
  await web.getByRole("checkbox", { name: /Autorizo/ }).click();
  await web.getByRole("button", { name: "Agendar" }).click();
  await expect(
    web.getByText("¡Listo, Ensayo! Tu cita quedó agendada"),
  ).toBeVisible();
  await web.waitForURL(/\/cita\/[0-9a-f]{32}$/);
  const token = web.url().split("/cita/")[1];
  const { data: cita } = await recepcion
    .from("citas")
    .select("id, origen, estado, hora_inicio")
    .eq("token", token)
    .single();
  expect(cita).toMatchObject({ origen: "en_linea", estado: "reservado" });
  expect(cita!.hora_inicio.slice(0, 5)).toBe(hora);

  // El profesional la ve en su agenda.
  await entrarComo(page, new RegExp(`Profesional · ${caso.pro}`));
  await page.goto(`/agenda?vista=dia&fecha=${dia}`);
  const bloque = page.locator(`[data-cita="${cita!.id}"]`);
  await expect(bloque).toHaveAttribute("aria-label", /Reservado/);

  // Recepción abre el WhatsApp en el buzón, lo abre como cliente y responde "SÍ".
  const buzon = await otraVentana(browser, info);
  await entrarComo(buzon, /Recepción/);
  await buzon.goto("/demo/buzon?canal=whatsapp");
  await buzon
    .getByRole("link")
    .filter({ hasText: `Ensayo ${apellido}` })
    .filter({ hasText: "Reserva creada" })
    .click();
  const [comoCliente] = await Promise.all([
    buzon.waitForEvent("popup"),
    buzon.getByRole("link", { name: "Abrir como cliente" }).click(),
  ]);
  await expect(comoCliente).toHaveURL(new RegExp(`/cita/${token}$`));
  await expect(comoCliente.getByText("Por confirmar")).toBeVisible();
  await buzon.getByRole("button", { name: "Responder: SÍ, confirmo" }).click();
  await expect(
    buzon.getByText("SÍ, confirmo mi cita. ¡Gracias!"),
  ).toBeVisible();
  await expect(bloque).toHaveAttribute("aria-label", /Confirmado/, {
    timeout: 10_000,
  });

  // El cliente cambia la hora desde su enlace: la agenda se mueve sola.
  await web.reload();
  await expect(web.getByText("Confirmada", { exact: true })).toBeVisible();
  await web.getByRole("button", { name: "Cambiar fecha u hora" }).click();
  const cambio = web.getByRole("dialog", { name: "Cambiar fecha u hora" });
  await irAlDia(cambio, dia);
  const nueva = await elegirHora(cambio, hora);
  await cambio.getByRole("button", { name: `Cambiar a las ${nueva}` }).click();
  await expect(aviso(web, "Listo: tu cita quedó")).toBeVisible();
  await expect(bloque).toHaveAttribute(
    "aria-label",
    new RegExp(`${nueva} – `),
    {
      timeout: 10_000,
    },
  );

  // Y la cancela: sale de la agenda.
  await web.getByRole("button", { name: "Cancelar cita" }).click();
  await web
    .getByRole("dialog", { name: "¿Cancelar tu cita?" })
    .getByRole("button", { name: "Sí, cancelar" })
    .click();
  await expect(web.getByText("La cancelaste.")).toBeVisible();
  await expect(bloque).toHaveCount(0, { timeout: 10_000 });
});

test("después de atendido, el cliente califica y el equipo lo ve en la ficha", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(90_000);
  const dia = diaDentroDe(3);
  const anon = clienteAnonimo();
  const { data: portada } = await anon.rpc("publico_negocio", {
    p_slug: SLUG,
  });
  const p = portada as unknown as {
    servicios: { id: string; nombre: string }[];
    profesionales: { id: string; nombre: string }[];
  };
  const servicioId = p.servicios.find((s) => s.nombre === caso.servicio)!.id;
  const proId = p.profesionales.find((x) => x.nombre === caso.pro)!.id;
  const { data: dias } = await anon.rpc("publico_disponibilidad", {
    p_slug: SLUG,
    p_servicios: [servicioId],
    p_profesional: proId,
    p_desde: dia,
    p_dias: 1,
  });
  const hora = (dias as unknown as { horas: string[] }[])[0].horas[0];
  const { data: reserva } = await anon.rpc("publico_reservar", {
    p: {
      slug: SLUG,
      servicios: [servicioId],
      profesionalId: proId,
      fecha: dia,
      hora,
      nombre: "Ensayo",
      apellido,
      correo: `publico.${proyecto}@ejemplo.test`,
      telefono: TELEFONOS[proyecto],
      autoriza: true,
    },
  });
  const token = (reserva as unknown as { token: string }).token;
  const { data: cita } = await recepcion
    .from("citas")
    .select("id")
    .eq("token", token)
    .single();
  // El equipo la marca "Asiste": llega el pedido de calificación.
  await recepcion.rpc("cambiar_estado_cita", {
    p_cita: cita!.id,
    p_estado: "asiste",
  });
  const { data: pedidos } = await recepcion
    .from("avisos_demo")
    .select("canal")
    .eq("cita_id", cita!.id)
    .eq("tipo", "calificacion");
  expect(pedidos!.length).toBeGreaterThan(0);

  const web = await otraVentana(browser, info);
  await web.goto(`/cita/${token}`);
  const nombre = caso.pro.split(" ")[0];
  await expect(web.getByText(`¿Cómo te atendió ${nombre}?`)).toBeVisible();
  await web.getByRole("radio", { name: "4 estrellas: Muy buena" }).click();
  await web.getByLabel("Comentario").fill(`Prueba ${proyecto}: muy bien.`);
  await web.getByRole("button", { name: "Enviar calificación" }).click();
  await expect(aviso(web, "Gracias por tu calificación")).toBeVisible();
  await expect(web.getByText("Tu calificación", { exact: true })).toBeVisible();

  await entrarComo(page, /Recepción/);
  await page.goto(`/agenda?vista=dia&fecha=${dia}`);
  await page.locator(`[data-cita="${cita!.id}"]`).click();
  await expect(page.getByText("Calificación del cliente")).toBeVisible();
  await expect(page.getByText(`Prueba ${proyecto}: muy bien.`)).toBeVisible();
  await expect(
    page.getByRole("img", { name: "4 de 5 estrellas" }),
  ).toBeVisible();
});
