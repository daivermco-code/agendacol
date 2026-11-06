import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { clienteServicio, NEGOCIO_DEMO } from "../integracion/ayuda";
import { chicos } from "./ayuda-44";

// Clientes en el celular (T-12.12): la lista A–Z con letras de sección y búsqueda; el botón flotante crea un
// cliente y abre su ficha en una hoja; cada dato se edita con su lápiz (error en la fila, Escape cancela sin cerrar
// la hoja, el foco vuelve a la fila); «Información adicional» plegable; «Eliminar cliente» con su pregunta y el
// foco de vuelta en la búsqueda. Un cliente con historia no se elimina, y su ficha también se abre como página.
// Solo en el proyecto celular; el cliente es propio («Lista E2E») y se borra al final.

const APELLIDO = "Lista E2E";
const NOMBRE = `Lina ${APELLIDO}`;
const CORREO = "lina.lista.e2e@ejemplo.test";

let servicio: SupabaseClient<Database>;

async function entrarComo(page: Page, rol: RegExp) {
  await page.goto("/entrar");
  await page.getByRole("button", { name: rol }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));
}

async function limpiar() {
  await servicio
    .from("clientes")
    .delete()
    .eq("negocio_id", NEGOCIO_DEMO)
    .eq("apellido", APELLIDO);
}

const aviso = (page: Page, texto: string) =>
  page.locator("[data-sonner-toast]").filter({ hasText: texto }).first();

test.beforeAll(async ({}, info) => {
  if (info.project.name !== "celular") return;
  servicio = clienteServicio();
  await limpiar();
});

test.afterAll(async ({}, info) => {
  if (info.project.name !== "celular") return;
  await limpiar();
});

test.beforeEach(async ({}, info) => {
  test.skip(info.project.name !== "celular", "solo en el celular");
});

test("lista A–Z, búsqueda, nuevo cliente, datos con lápiz y eliminar", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const malos: string[] = [];
  await entrarComo(page, /Recepción/);

  // 1. La lista: título, búsqueda, cantidad y secciones por letra con iniciales y correo.
  await page.goto("/clientes");
  await expect(
    page.getByRole("heading", { level: 1, name: "Clientes" }),
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("status")).toContainText(
    /\d+ clientes/,
  );
  await expect(
    page.getByRole("heading", { name: "A", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /^Alejandro Castro/,
    }),
  ).toBeVisible();
  malos.push(...(await chicos(page, "lista")));

  // 2. Buscar: con resultados y sin resultados (la dirección guarda lo buscado).
  const buscar = page.getByRole("searchbox", { name: "Buscar clientes" });
  await buscar.fill("Acosta");
  await page.waitForURL(/\?q=Acosta$/);
  await expect(page.getByRole("main").getByRole("status")).toContainText(
    "para «Acosta»",
  );
  await expect(
    page.getByRole("button", { name: /^Carolina Acosta/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "C", exact: true }),
  ).toBeVisible();
  await buscar.fill("zzzz");
  await expect(
    page.getByText("Nadie coincide con «zzzz»").filter({ visible: true }),
  ).toBeVisible();
  await buscar.fill("");
  await page.waitForURL(/\/clientes$/);

  // 3. Nuevo cliente desde el botón flotante: al crearlo se abre su ficha en una hoja.
  await page.getByRole("button", { name: "Nuevo cliente" }).click();
  const ventana = page.getByRole("dialog", { name: "Nuevo cliente" });
  await ventana.locator("#cliente-nombre").fill("Lina");
  await ventana.locator("#cliente-apellido").fill(APELLIDO);
  await ventana.getByRole("button", { name: "Crear cliente" }).click();
  await expect(aviso(page, "Cliente creado")).toBeVisible();
  const hoja = page.getByRole("dialog", { name: NOMBRE });
  await expect(hoja).toBeVisible();
  // El foco entra a la hoja (vaul lo deja afuera si no se mueve a mano).
  await expect
    .poll(() => hoja.evaluate((h) => h.contains(document.activeElement)))
    .toBe(true);
  await expect(
    hoja.getByText(/^Cliente desde el \d\d\/\d\d\/\d{4}$/),
  ).toBeVisible();
  malos.push(...(await chicos(page, "ficha")));

  // 4. El correo con su lápiz: un correo malo deja el error en la fila; uno bueno se guarda.
  await hoja
    .getByRole("button", { name: "Correo: Toca para llenar. Editar" })
    .click();
  const correo = hoja.locator("#ficha-correo");
  await expect(correo).toBeFocused();
  await correo.fill("abc");
  await hoja.getByRole("button", { name: "Guardar" }).click();
  await expect(hoja.getByRole("alert")).toHaveText("El correo no es válido");
  await expect(correo).toHaveAttribute("aria-invalid", "true");
  malos.push(...(await chicos(page, "dato abierto")));
  await correo.fill(CORREO);
  await hoja.getByRole("button", { name: "Guardar" }).click();
  await expect(aviso(page, "Cambio guardado")).toBeVisible();
  const filaCorreo = hoja.getByRole("button", {
    name: `Correo: ${CORREO}. Editar`,
  });
  await expect(filaCorreo).toBeFocused();
  const { data: guardado } = await servicio
    .from("clientes")
    .select("id, correo")
    .eq("apellido", APELLIDO)
    .single();
  expect(guardado?.correo).toBe(CORREO);

  // 5. Con un dato abierto, tocar otro lo cambia y el foco va al nuevo. Escape cancela la edición y la hoja
  // sigue; otro Escape la cierra y el foco vuelve al botón flotante (la ventana de «Nuevo cliente» ya no está).
  await filaCorreo.click();
  await hoja.getByRole("button", { name: "Nombre: Lina. Editar" }).click();
  await expect(hoja.locator("#ficha-correo")).toHaveCount(0);
  await expect(hoja.locator("#ficha-nombre")).toBeFocused();
  await hoja.locator("#ficha-nombre").fill("Otra");
  await page.keyboard.press("Escape");
  await expect(hoja.locator("#ficha-nombre")).toHaveCount(0);
  const filaNombre = hoja.getByRole("button", { name: "Nombre: Lina. Editar" });
  await expect(filaNombre).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(hoja).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Nuevo cliente" }),
  ).toBeFocused();

  // 6. Volver a abrirla desde la lista: «Información adicional» se despliega.
  await buscar.fill(APELLIDO);
  await page.waitForURL(/\?q=Lista/);
  const fila = page.getByRole("button", { name: new RegExp(`^${NOMBRE}`) });
  await fila.click();
  await expect(hoja).toBeVisible();
  const adicional = hoja.getByRole("button", { name: "Información adicional" });
  await expect(adicional).toHaveAttribute("aria-expanded", "false");
  await adicional.click();
  await expect(adicional).toHaveAttribute("aria-expanded", "true");
  await expect(
    hoja.getByRole("button", { name: "Barrio: Toca para llenar. Editar" }),
  ).toBeVisible();

  // 7. Eliminar: pregunta, aviso, la lista sin él y el foco en el título (en la búsqueda abriría el teclado).
  await hoja.getByRole("button", { name: "Eliminar cliente" }).click();
  await page
    .getByRole("dialog", { name: `¿Eliminar a ${NOMBRE}?` })
    .getByRole("button", { name: "Eliminar", exact: true })
    .click();
  await expect(aviso(page, "Cliente eliminado")).toBeVisible();
  await expect(
    page
      .getByText(`Nadie coincide con «${APELLIDO}»`)
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Clientes" }),
  ).toBeFocused();
  const { count } = await servicio
    .from("clientes")
    .select("id", { count: "exact", head: true })
    .eq("apellido", APELLIDO);
  expect(count).toBe(0);

  expect(malos).toEqual([]);
});

test("un cliente con historia no se elimina y su ficha abre como página", async ({
  page,
}) => {
  const { data: carolina } = await servicio
    .from("clientes")
    .select("id")
    .eq("negocio_id", NEGOCIO_DEMO)
    .eq("nombre", "Carolina")
    .eq("apellido", "Acosta")
    .single();
  if (!carolina) throw new Error("Falta Carolina Acosta en la semilla");
  await entrarComo(page, /Recepción/);

  await page.goto(`/clientes/${carolina.id}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Carolina Acosta" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Reservas \(\d+\)$/ }),
  ).toBeVisible();
  const eliminar = page.getByRole("button", { name: "Eliminar cliente" });
  await expect(eliminar).toBeDisabled();
  await expect(eliminar).toHaveAccessibleDescription(
    "Tiene reservas o ventas: su ficha se conserva.",
  );
  await expect(
    page.getByRole("heading", { level: 2, name: /^Reservas/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Tiene reservas o ventas: su ficha se conserva."),
  ).toBeVisible();
  expect(await chicos(page, "ficha como página")).toEqual([]);

  await page
    .getByRole("main")
    .getByRole("link", { name: "Clientes", exact: true })
    .click();
  await page.waitForURL(/\/clientes$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Clientes" }),
  ).toBeVisible();
});
