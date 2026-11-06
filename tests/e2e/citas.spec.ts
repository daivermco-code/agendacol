import { expect, test, type Locator, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { clienteComo } from "../integracion/ayuda";
import {
  aHora,
  aMinutos,
  ahoraEnZona,
} from "../../src/features/agenda/lib/fechas";
import { ALTO_FILA } from "../../src/features/agenda/lib/geometria";

// Citas de punta a punta. Cada tamaño usa su propio profesional, cliente y día de la semana, desde dentro de 15
// semanas: la semilla llega a 4 semanas adelante, las otras E2E usan de la 2 a la 7 y las de integración de la 6
// a la 13. Esta ocupa de la 15 a la 20 (la serie de 4 semanas y la cita de dentro de 5): no comparte días con nadie.
type Cliente = SupabaseClient<Database>;

interface Caso {
  pro: string;
  proId: string;
  servicio: string;
  correo: string;
  diaSemana: number;
}

const LOCAL = "a1000000-0000-4000-8000-000000000001";
const CASOS: Record<string, Caso> = {
  computador: {
    pro: "Carolina Ruiz",
    proId: "b0000000-0000-4000-8000-000000000001",
    servicio: "Corte de dama",
    correo: "ana.sanchez1@ejemplo.test",
    diaSemana: 2,
  },
  "tableta-horizontal": {
    pro: "Andrés Molina",
    proId: "b0000000-0000-4000-8000-000000000002",
    servicio: "Corte de caballero",
    correo: "andrea.torres58@ejemplo.test",
    diaSemana: 3,
  },
  "tableta-vertical": {
    pro: "Valentina Ospina",
    proId: "b0000000-0000-4000-8000-000000000003",
    servicio: "Manicure tradicional",
    correo: "alejandro.jimenez25@ejemplo.test",
    diaSemana: 4,
  },
  celular: {
    pro: "Julián Herrera",
    proId: "b0000000-0000-4000-8000-000000000004",
    servicio: "Arreglo de barba",
    correo: "camila.moreno2@ejemplo.test",
    diaSemana: 5,
  },
};

let caso: Caso;
let dia: string;
let proyecto: string;
let recepcion: Cliente;
let cliente: { id: string; nombre: string };
let servicio: { id: string; duracion_min: number; precio: number };
let bloque: number;

/** El día de la semana del caso dentro de 15 semanas, en la zona del negocio. */
function diaDelCaso(diaSemana: number): string {
  const d = new Date(`${ahoraEnZona().fecha}T12:00:00Z`);
  const lunes = d.getUTCDate() - ((d.getUTCDay() + 6) % 7);
  d.setUTCDate(lunes + 15 * 7 + diaSemana - 1);
  return d.toISOString().slice(0, 10);
}

function masDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Cita de apoyo creada directo en la base (forzada si cae fuera de horario). */
async function citaFija(
  fecha: string,
  hora: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await recepcion.rpc("guardar_cita", {
    p: {
      localId: LOCAL,
      clienteId: cliente.id,
      profesionalId: caso.proId,
      servicioId: servicio.id,
      fecha,
      horaInicio: hora,
      duracionMin: servicio.duracion_min,
      precio: servicio.precio,
      estado: "reservado",
      forzar: true,
      ...extra,
    },
  });
  const r = data as { ok?: boolean; citaIds?: string[] } | null;
  if (error || !r?.ok || !r.citaIds?.[0])
    throw new Error(`No se creó la cita de apoyo de las ${hora}`);
  return r.citaIds[0];
}

async function citasDe(fecha: string) {
  const { data } = await recepcion
    .from("citas")
    .select("id, hora_inicio, estado, serie_id, cliente_id")
    .eq("profesional_id", caso.proId)
    .eq("fecha", fecha)
    .order("hora_inicio");
  return data ?? [];
}

async function limpiar() {
  // Desde su primer día y solo sus clientes (el de la semilla, los «E2E <tamaño>» y sin cliente): las pruebas de
  // integración también usan semanas lejanas con estos profesionales.
  const { data: propios } = await recepcion
    .from("clientes")
    .select("id")
    .eq("apellido", `E2E ${proyecto}`);
  const ids = [cliente.id, ...(propios ?? []).map((c) => c.id)];
  await recepcion
    .from("citas")
    .delete()
    .eq("profesional_id", caso.proId)
    .gte("fecha", dia)
    .or(`cliente_id.is.null,cliente_id.in.(${ids.join(",")})`);
  await recepcion
    .from("bloqueos")
    .delete()
    .eq("profesional_id", caso.proId)
    .gte("inicio", dia);
  await recepcion.from("clientes").delete().eq("apellido", `E2E ${proyecto}`);
}

test.beforeAll(async ({}, info) => {
  proyecto = info.project.name;
  const elegido = CASOS[proyecto];
  if (!elegido) throw new Error(`Sin caso para ${proyecto}`);
  caso = elegido;
  dia = diaDelCaso(caso.diaSemana);
  recepcion = await clienteComo("recepcion@salonceiba.test");
  const [c, s, a] = await Promise.all([
    recepcion
      .from("clientes")
      .select("id, nombre, apellido")
      .eq("correo", caso.correo)
      .single(),
    recepcion
      .from("servicios")
      .select("id, duracion_min, precio")
      .eq("nombre", caso.servicio)
      .single(),
    recepcion.from("ajustes").select("bloque_min").single(),
  ]);
  if (!c.data || !s.data || !a.data)
    throw new Error("Faltan datos de la semilla: corre npm run db:reset");
  cliente = { id: c.data.id, nombre: `${c.data.nombre} ${c.data.apellido}` };
  servicio = s.data;
  bloque = a.data.bloque_min;
  await limpiar();
});

test.afterAll(async () => {
  await limpiar();
});

async function entrarComo(page: Page, rol: RegExp) {
  await page.goto("/entrar");
  await page.getByRole("button", { name: rol }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));
  await page.evaluate(() => localStorage.removeItem("agedacol-agenda"));
}

async function abrirDia(page: Page, fecha: string) {
  await page.goto(`/agenda?vista=dia&fecha=${fecha}`);
  await expect(
    page.getByRole("columnheader", { name: caso.pro }),
  ).toBeVisible();
}

async function abrirNuevo(page: Page, que: "Reserva" | "Bloquear horario") {
  await page
    .getByRole("button", { name: "Nuevo", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name: que }).click();
}

const ventana = (page: Page, titulo: string) =>
  page.getByRole("dialog", { name: titulo });
const aviso = (page: Page, texto: string) =>
  page.locator("[data-sonner-toast]").filter({ hasText: texto });

/** El campo de cliente: en el celular es un botón que abre una hoja con la búsqueda (T-12.4). */
async function escribirCliente(page: Page, texto: string) {
  const campo = page.locator("#reserva-cliente");
  if ((await campo.evaluate((n) => n.tagName)) === "BUTTON") {
    await campo.click();
    await page.locator("#reserva-cliente-buscar").fill(texto);
  } else await campo.fill(texto);
}

/** "Nuevo cliente" junto al buscador, o "Crear cliente nuevo" al pie de la hoja del celular. */
async function nuevoCliente(page: Page) {
  await page
    .getByRole("button", { name: /^(Nuevo cliente|Crear cliente nuevo)$/ })
    .click();
}

async function elegirCliente(page: Page, texto: string) {
  await escribirCliente(page, texto);
  await page
    .getByRole("option")
    .or(
      page
        .getByRole("list", { name: "Clientes encontrados" })
        .getByRole("button"),
    )
    .filter({ hasText: texto })
    .first()
    .click();
  await expect(
    page.getByRole("dialog", { name: "Elegir cliente" }),
  ).toHaveCount(0);
}

/** Llena fecha, hora, profesional y servicio de la ventana de reserva abierta. */
async function llenarReserva(page: Page, fecha: string, hora: string) {
  await page.locator("#reserva-fecha").fill(fecha);
  await page.locator("#reserva-hora").selectOption(hora.slice(0, 2));
  await page.getByLabel("Minutos de hora").selectOption(hora.slice(3, 5));
  await page.locator("#reserva-profesional").selectOption({ label: caso.pro });
  const servicio = page.locator("#reserva-servicio");
  if ((await servicio.evaluate((n) => n.tagName)) === "BUTTON") {
    // Celular: el servicio se elige en una hoja (T-12.4).
    await servicio.click();
    const hoja = page.getByRole("dialog", { name: "Elegir servicio" });
    await hoja
      .getByRole("button")
      .filter({ hasText: caso.servicio })
      .first()
      .click();
    await expect(hoja).toHaveCount(0);
    return;
  }
  const valor = await page
    .locator("#reserva-servicio option")
    .filter({ hasText: caso.servicio })
    .first()
    .getAttribute("value");
  await servicio.selectOption(valor ?? "");
}

async function abrirFicha(page: Page, citaId: string): Promise<Locator> {
  const b = page.locator(`[data-cita="${citaId}"]`);
  await b.click();
  await expect(
    page.getByRole("button", { name: "Cerrar ficha" }),
  ).toBeVisible();
  return b;
}

/** Arrastra un bloque dy píxeles hacia abajo: con ratón, o con presión larga en las pantallas táctiles. */
async function arrastrar(page: Page, el: Locator, dy: number, tactil: boolean) {
  await el.evaluate((n) =>
    n.scrollIntoView({ block: "center", inline: "center" }),
  );
  const caja = await el.boundingBox();
  if (!caja) throw new Error("El bloque no se ve");
  const x = caja.x + caja.width / 2;
  const y = caja.y + Math.min(10, caja.height / 2);
  if (!tactil) {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 8, { steps: 4 });
    await page.mouse.move(x, y + dy, { steps: 12 });
    await page.mouse.up();
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  const tocar = (type: "touchStart" | "touchMove" | "touchEnd", py: number) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y: py }],
    });
  await tocar("touchStart", y);
  // La presión larga del celular es de 300 ms (T-12.7): con 380 alcanza y deja margen.
  await page.waitForTimeout(380);
  for (let i = 1; i <= 12; i++) await tocar("touchMove", y + (dy * i) / 12);
  await tocar("touchEnd", y + dy);
}

test.beforeEach(async ({ page }) => {
  await entrarComo(page, /Recepción/);
});

test("crear una reserva con un cliente nuevo", async ({ page }) => {
  await page.goto("/agenda?vista=dia");
  await abrirNuevo(page, "Reserva");
  await expect(ventana(page, "Nueva reserva")).toBeVisible();
  await llenarReserva(page, dia, "11:00");
  await escribirCliente(page, `Ensayo E2E ${proyecto}`);
  await nuevoCliente(page);
  await expect(page.locator("#cliente-apellido")).toHaveValue(
    `E2E ${proyecto}`,
  );
  await page.locator("#cliente-correo").fill(`ensayo.${proyecto}@ejemplo.test`);
  await page.getByRole("button", { name: "Crear cliente" }).click();
  const dialogo = ventana(page, "Nueva reserva");
  await expect(
    dialogo.getByText("Nuevo cliente", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Guardar reserva" }).click();
  await expect(aviso(page, "Reserva creada")).toBeVisible();
  const citas = await citasDe(dia);
  expect(citas.map((c) => c.hora_inicio.slice(0, 5))).toContain("11:00");
});

test("un cliente con el mismo nombre se detecta y se reutiliza", async ({
  page,
}) => {
  await page.goto("/agenda?vista=dia");
  await abrirNuevo(page, "Reserva");
  await escribirCliente(page, cliente.nombre);
  await nuevoCliente(page);
  await page.getByRole("button", { name: "Crear cliente" }).click();
  await expect(page.getByText("Ya hay clientes parecidos")).toBeVisible();
  await page.getByRole("button", { name: "Usar este" }).first().click();
  const dialogo = ventana(page, "Nueva reserva");
  await expect(dialogo.getByText(cliente.nombre).first()).toBeVisible();
  await expect(dialogo.locator("#reserva-cliente")).toHaveCount(0);
});

test("un choque con otra cita no deja guardar", async ({ page }) => {
  await citaFija(dia, "12:00");
  await page.goto("/agenda?vista=dia");
  await abrirNuevo(page, "Reserva");
  await llenarReserva(page, dia, "12:00");
  await elegirCliente(page, caso.correo);
  await page.getByRole("button", { name: "Guardar reserva" }).click();
  const choque = ventana(page, "Hay un choque de horario");
  await expect(choque).toBeVisible();
  await expect(
    choque.getByRole("button", { name: "Agendar de todas formas" }),
  ).toHaveCount(0);
  await choque.getByRole("button", { name: "Volver" }).click();
  await expect(choque).toBeHidden();
  await expect(ventana(page, "Nueva reserva")).toBeVisible();
  const a12 = (await citasDe(dia)).filter((c) =>
    c.hora_inicio.startsWith("12:00"),
  );
  expect(a12).toHaveLength(1);
});

test("fuera de horario se puede forzar", async ({ page }) => {
  await page.goto("/agenda?vista=dia");
  await abrirNuevo(page, "Reserva");
  await llenarReserva(page, dia, "20:00");
  await elegirCliente(page, caso.correo);
  await page.getByRole("button", { name: "Guardar reserva" }).click();
  const choque = ventana(page, "Hay un choque de horario");
  await choque.getByRole("button", { name: "Agendar de todas formas" }).click();
  await expect(aviso(page, "Reserva creada")).toBeVisible();
  const horas = (await citasDe(dia)).map((c) => c.hora_inicio.slice(0, 5));
  expect(horas).toContain("20:00");
});

test("el estado cambia con un clic desde la ficha", async ({ page }) => {
  const id = await citaFija(dia, "14:00");
  await abrirDia(page, dia);
  const b = await abrirFicha(page, id);
  await page.getByRole("button", { name: "Cambiar a Confirmado" }).click();
  await expect(b).toHaveAttribute("aria-label", /Confirmado/);
  await expect
    .poll(async () => (await citasDe(dia)).find((c) => c.id === id)?.estado)
    .toBe("confirmado");
});

test("editar la hora de una reserva", async ({ page }) => {
  const id = await citaFija(dia, "15:00");
  await abrirDia(page, dia);
  await abrirFicha(page, id);
  await page.getByRole("button", { name: "Editar cita" }).click();
  await expect(ventana(page, "Editar reserva")).toBeVisible();
  await page.getByLabel("Minutos de hora").selectOption("15");
  await page.getByRole("button", { name: "Guardar reserva" }).click();
  await expect(aviso(page, "Reserva guardada")).toBeVisible();
  const cita = (await citasDe(dia)).find((c) => c.id === id);
  expect(cita?.hora_inicio.slice(0, 5)).toBe("15:15");
});

test("mover una cita arrastrándola", async ({ page }, info) => {
  const id = await citaFija(dia, "16:00");
  await abrirDia(page, dia);
  const tactil = info.project.use.hasTouch === true;
  await arrastrar(
    page,
    page.locator(`[data-cita="${id}"]`),
    ALTO_FILA + 3,
    tactil,
  );
  await expect(aviso(page, "Cita movida")).toBeVisible();
  const cita = (await citasDe(dia)).find((c) => c.id === id);
  expect(cita?.hora_inicio.slice(0, 5)).toBe(aHora(aMinutos("16:00") + bloque));

  // "Deshacer" en el aviso la devuelve a su hora.
  await aviso(page, "Cita movida")
    .getByRole("button", { name: "Deshacer" })
    .click();
  await expect(aviso(page, "Cita devuelta a su lugar")).toBeVisible();
  await expect
    .poll(async () =>
      (await citasDe(dia)).find((c) => c.id === id)?.hora_inicio.slice(0, 5),
    )
    .toBe("16:00");
});

test("mover fuera de horario pregunta y deja mover igual", async ({
  page,
}, info) => {
  // A las 22:00 (las 20:00 las usa «fuera de horario se puede forzar», que corre antes) y una fila arriba.
  const id = await citaFija(dia, "22:00");
  await abrirDia(page, dia);
  await arrastrar(
    page,
    page.locator(`[data-cita="${id}"]`),
    -(ALTO_FILA + 3),
    info.project.use.hasTouch === true,
  );
  const choque = ventana(page, "Hay un choque de horario");
  await expect(choque).toBeVisible();
  await choque.getByRole("button", { name: "Mover igual" }).click();
  await expect(aviso(page, "Cita movida")).toBeVisible();
  const cita = (await citasDe(dia)).find((c) => c.id === id);
  expect(cita?.hora_inicio.slice(0, 5)).toBe(aHora(aMinutos("22:00") - bloque));
});

test("repetir 4 semanas y cancelar toda la serie", async ({ page }) => {
  const inicio = masDias(dia, 7);
  await page.goto("/agenda?vista=dia");
  await abrirNuevo(page, "Reserva");
  await llenarReserva(page, inicio, "11:00");
  await elegirCliente(page, caso.correo);
  await page.locator("#reserva-repetir").click();
  await expect(page.getByText("Se agendan 4 de 4")).toBeVisible();
  await page.getByRole("button", { name: "Guardar reserva" }).click();
  await expect(aviso(page, "Se crearon 4 reservas")).toBeVisible();
  const [primera] = await citasDe(inicio);
  if (!primera?.serie_id) throw new Error("La serie no quedó en la base");
  const { data: serie } = await recepcion
    .from("citas")
    .select("id, estado")
    .eq("serie_id", primera.serie_id);
  expect(serie).toHaveLength(4);

  await abrirDia(page, inicio);
  await abrirFicha(page, primera.id);
  await page.getByRole("button", { name: "Cancelar o eliminar cita" }).click();
  const cancelar = ventana(page, "¿Qué hacemos con esta cita?");
  await cancelar.getByLabel("Toda la serie").click();
  await cancelar
    .getByRole("button", { name: "Cancelar cita", exact: true })
    .click();
  await expect(aviso(page, "Cita cancelada")).toBeVisible();
  const { data: despues } = await recepcion
    .from("citas")
    .select("estado")
    .eq("serie_id", primera.serie_id);
  expect(despues?.every((c) => c.estado === "cancelado")).toBe(true);
});

test("bloquear el almuerzo, abrirlo y borrarlo", async ({ page }) => {
  await page.goto("/agenda?vista=dia");
  await abrirNuevo(page, "Bloquear horario");
  const v = ventana(page, "Bloquear horario");
  await v.getByRole("button", { name: "Almuerzo" }).click();
  await page.locator("#bloqueo-profesional").selectOption(caso.proId);
  await page.locator("#bloqueo-fechaInicio").fill(dia);
  await page.getByLabel("Hora de inicio", { exact: true }).selectOption("13");
  await page.getByLabel("Minutos de hora de inicio").selectOption("00");
  await page.locator("#bloqueo-fechaFin").fill(dia);
  await page.getByLabel("Hora de fin", { exact: true }).selectOption("14");
  await page.getByLabel("Minutos de hora de fin").selectOption("00");
  await v.getByRole("button", { name: "Bloquear" }).click();
  await expect(aviso(page, "Horario bloqueado")).toBeVisible();

  await abrirDia(page, dia);
  await page
    .getByRole("button", { name: "Bloqueo: Almuerzo, 13:00 – 14:00" })
    .click();
  const editar = ventana(page, "Editar bloqueo");
  await expect(editar.locator("#bloqueo-motivo")).toHaveValue("Almuerzo");
  await editar.getByRole("button", { name: "Eliminar" }).click();
  await editar
    .getByRole("alert")
    .getByRole("button", { name: "Eliminar" })
    .click();
  await expect(aviso(page, "Bloqueo eliminado")).toBeVisible();
});

test("el buzón muestra aviso, recordatorio, cambio y cancelación", async ({
  page,
}) => {
  const fecha = masDias(dia, 35);
  const a = await citaFija(fecha, "11:00");
  await citaFija(fecha, "11:30", { id: a });
  const b = await citaFija(fecha, "14:00");
  await recepcion.rpc("cancelar_cita", {
    p_cita: b,
    p_alcance: "solo_esta",
    p_motivo: "Prueba",
  });
  await page.goto("/demo/buzon");
  const fila = (...textos: string[]) =>
    textos.reduce(
      (l, t) => l.filter({ hasText: t }),
      page.getByRole("link").filter({ hasText: cliente.nombre }),
    );
  await expect(fila("Reserva creada").first()).toBeVisible();
  await expect(fila("Recordatorio", "Programado").first()).toBeVisible();
  await expect(fila("Cambio de cita").first()).toBeVisible();
  await fila("Cancelación").first().click();
  await expect(page.getByRole("article")).toContainText(
    cliente.nombre.split(" ")[0] ?? "",
  );
});

test("el profesional ve su cita sin contacto y cambia su estado", async ({
  page,
  context,
}) => {
  const id = await citaFija(masDias(dia, 35), "16:00");
  await context.clearCookies();
  await entrarComo(page, new RegExp(`Profesional · ${caso.pro.split(" ")[0]}`));
  await page.goto(`/agenda?vista=dia&fecha=${masDias(dia, 35)}`);
  // Una sola columna de profesional (la otra cabecera es la de las horas).
  await expect(
    page.getByRole("columnheader").filter({ hasNotText: "Horas" }),
  ).toHaveCount(1);
  await expect(
    page
      .getByRole("button", { name: "Nuevo", exact: true })
      .filter({ visible: true }),
  ).toHaveCount(0);
  await abrirFicha(page, id);
  await expect(
    page.getByText("El contacto del cliente lo ve recepción."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar cita" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Cambiar a Confirmado" }).click();
  await expect
    .poll(async () => {
      const { data } = await recepcion
        .from("citas")
        .select("estado")
        .eq("id", id)
        .single();
      return data?.estado;
    })
    .toBe("confirmado");
});
