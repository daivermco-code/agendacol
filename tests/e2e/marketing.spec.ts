import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { clienteServicio } from "../integracion/ayuda";

// Campaña de correo de punta a punta: la dueña escribe un borrador para la audiencia «No vienen hace 3 semanas»,
// lo envía y lo ve en el buzón de la demo, un correo por cliente con su nombre. Cada tamaño usa su propio asunto;
// al final se borran sus campañas (los correos del buzón se van con ellas y el cupo del mes vuelve a quedar igual).
type Cliente = SupabaseClient<Database>;

const AUDIENCIA = "No vienen hace 3 semanas";

let servicio: Cliente;
let asunto: string;

async function limpiar() {
  await servicio.from("campanas").delete().eq("asunto", asunto);
}

test.beforeAll(async ({}, info) => {
  servicio = clienteServicio();
  asunto = `Campaña E2E ${info.project.name}`;
  await limpiar();
});

test.afterAll(async () => {
  await limpiar();
});

async function entrarComo(page: Page, rol: RegExp) {
  await page.goto("/entrar");
  await page.getByRole("button", { name: rol }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));
}

const aviso = (page: Page, texto: string | RegExp) =>
  page.locator("[data-sonner-toast]").filter({ hasText: texto });

test("escribir una campaña, enviarla a una audiencia y verla en el buzón", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await entrarComo(page, /Dueño/);
  await page.goto("/clientes/marketing");

  // 1. Borrador para la audiencia, con la vista previa a nombre de Ana.
  await page.getByRole("button", { name: "Nueva campaña" }).click();
  const ventana = page.getByRole("dialog", { name: "Nueva campaña" });
  await ventana
    .locator("#campana-audiencia")
    .selectOption({ label: AUDIENCIA });
  await expect(ventana.getByText(/\d+ de \d+ reciben el correo/)).toBeVisible();
  await ventana.getByLabel("Asunto").fill(asunto);
  await ventana
    .getByLabel("Mensaje")
    .fill(
      "Hola {nombre}, te extrañamos: esta semana tu corte va con 10 % menos.",
    );
  await expect(
    ventana
      .getByRole("region", { name: "Vista previa" })
      .getByText("Hola Ana, te extrañamos"),
  ).toBeVisible();
  await ventana.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(aviso(page, "Borrador guardado")).toBeVisible();
  const fila = page.getByRole("listitem").filter({ hasText: asunto });
  await expect(fila.getByText("Borrador", { exact: true })).toBeVisible();

  // 2. Enviar: confirma a cuántos les llega y queda enviada.
  await fila.getByRole("button", { name: "Enviar" }).click();
  await page
    .getByRole("dialog", { name: `¿Enviar "${asunto}"?` })
    .getByRole("button", { name: "Enviar" })
    .click();
  await expect(aviso(page, /Campaña enviada a \d+ clientes/)).toBeVisible();
  await expect(fila.getByText("Enviada", { exact: true })).toBeVisible();
  const { data: campana } = await servicio
    .from("campanas")
    .select("id, estado, destinatarios")
    .eq("asunto", asunto)
    .single();
  expect(campana?.estado).toBe("enviada");
  const n = campana?.destinatarios ?? 0;
  expect(n).toBeGreaterThan(0);

  // 3. El buzón de la campaña: un correo por cliente, con su nombre en el mensaje. Los clientes de prueba de otros
  // archivos también caen en la audiencia y su limpieza borra sus correos: se cuenta hasta `n` y se revisa el
  // correo de un cliente de la semilla.
  await fila.getByRole("link", { name: "Ver en el buzón" }).click();
  await page.waitForURL(new RegExp(`/demo/buzon\\?campana=${campana!.id}`));
  const correos = page
    .getByRole("link")
    .filter({ hasText: "Campaña de correo" });
  await expect(correos.first()).toBeVisible();
  expect(await correos.count()).toBeLessThanOrEqual(n);
  const { data: uno } = await servicio
    .from("avisos_demo")
    .select("destinatario, cuerpo")
    .eq("campana_id", campana!.id)
    .not("destinatario", "ilike", "%E2E%")
    .order("destinatario")
    .limit(1)
    .single();
  const primerNombre = uno?.destinatario?.split(" ")[0] ?? "";
  expect(uno?.cuerpo).toBe(
    `Hola ${primerNombre}, te extrañamos: esta semana tu corte va con 10 % menos.`,
  );
  await correos.filter({ hasText: uno!.destinatario! }).first().click();
  await expect(page.getByText(asunto).first()).toBeVisible();
  await expect(
    page.getByText(`Hola ${primerNombre}, te extrañamos`).first(),
  ).toBeVisible();
});
