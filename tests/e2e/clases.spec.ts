import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { clienteServicio, NEGOCIO_DEMO } from "../integracion/ayuda";
import { ahoraEnZona } from "../../src/features/agenda/lib/fechas";

// Clases con cupo de punta a punta: recepción agenda el «Taller de automaquillaje» con cupo 2 desde el menú Nuevo
// de la agenda, inscribe a dos clientes desde la ficha de la clase y la clase queda llena (ya no deja inscribir).
// Lo da Valentina Ospina (la única que lo da); cada tamaño usa su día de la semana dentro de 7 semanas (lejos de
// las otras pruebas), así los 4 corren a la vez. Al final se borran la clase y los clientes.
type Cliente = SupabaseClient<Database>;

const PRO = "Valentina Ospina";
const PRO_ID = "b0000000-0000-4000-8000-000000000003";
const DIAS: Record<string, number> = {
  computador: 2,
  "tableta-horizontal": 3,
  "tableta-vertical": 4,
  celular: 5,
};
const ALUMNAS = ["Lucía", "Marta"];

let servicio: Cliente;
let apellido: string;
let dia: string;

/** El día de la semana ISO `diaSemana` (1 = lunes) de dentro de `semanas` semanas, en la zona del negocio. */
function diaDentroDe(semanas: number, diaSemana: number): string {
  const d = new Date(`${ahoraEnZona().fecha}T12:00:00Z`);
  const lunes = d.getUTCDate() - ((d.getUTCDay() + 6) % 7);
  d.setUTCDate(lunes + semanas * 7 + diaSemana - 1);
  return d.toISOString().slice(0, 10);
}

async function limpiar() {
  await servicio
    .from("clases")
    .delete()
    .eq("profesional_id", PRO_ID)
    .eq("fecha", dia);
  await servicio.from("clientes").delete().eq("apellido", apellido);
}

test.beforeAll(async ({}, info) => {
  servicio = clienteServicio();
  apellido = `Clase E2E ${info.project.name}`;
  dia = diaDentroDe(7, DIAS[info.project.name]);
  await limpiar();
  const { error } = await servicio.from("clientes").insert(
    ALUMNAS.map((nombre) => ({
      negocio_id: NEGOCIO_DEMO,
      nombre,
      apellido,
    })),
  );
  if (error) throw new Error(error.message);
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

const aviso = (page: Page, texto: string) =>
  page.locator("[data-sonner-toast]").filter({ hasText: texto });

test("agendar una clase con cupo, inscribir hasta llenarla", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await entrarComo(page, /Recepción/);
  await page.goto(`/agenda?vista=dia&fecha=${dia}`);
  await expect(page.getByRole("columnheader", { name: PRO })).toBeVisible();

  // 1. Nuevo → Clase: el taller con Valentina a las 10:00 y cupo 2.
  await page
    .getByRole("button", { name: "Nuevo", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Clase" }).click();
  const ventana = page.getByRole("dialog", { name: "Nueva clase" });
  await ventana.locator("#clase-servicio").selectOption({
    label: "Taller de automaquillaje",
  });
  await ventana.locator("#clase-profesional").selectOption({ label: PRO });
  await ventana.locator("#clase-fecha").fill(dia);
  await ventana.locator("#clase-hora").selectOption("10");
  await ventana.getByLabel("Minutos de hora").selectOption("00");
  await ventana.locator("#clase-cupo").fill("2");
  await ventana.getByRole("button", { name: "Agendar clase" }).click();
  await expect(aviso(page, "Clase agendada")).toBeVisible();
  const { data: clase } = await servicio
    .from("clases")
    .select("id, cupo, hora_inicio")
    .eq("profesional_id", PRO_ID)
    .eq("fecha", dia)
    .single();
  expect(clase).toMatchObject({ cupo: 2, hora_inicio: "10:00:00" });

  // 2. En la agenda, el bloque de la clase; su ficha inscribe a las dos alumnas.
  const bloque = page.locator(`[data-clase="${clase!.id}"]`);
  await expect(bloque).toHaveAttribute("aria-label", /0 de 2 inscritos/);
  await bloque.click();
  const ficha = page.getByRole("dialog", {
    name: "Clase Taller de automaquillaje",
  });
  for (const nombre of ALUMNAS) {
    await ficha.getByRole("combobox").fill(`${nombre} ${apellido}`);
    await page
      .getByRole("option")
      .filter({ hasText: `${nombre} ${apellido}` })
      .click();
    await ficha.getByRole("button", { name: "Inscribir" }).click();
    await expect(aviso(page, `${nombre} ya está en la clase`)).toBeVisible();
  }

  // 3. Llena: la ficha lo dice, ya no deja inscribir y el bloque de la agenda también lo muestra.
  await expect(ficha.getByText("Llena (2 de 2)")).toBeVisible();
  await expect(
    ficha.getByRole("list", { name: "Inscritos" }).getByRole("listitem"),
  ).toHaveCount(2);
  await expect(ficha.getByText("Inscribir cliente")).toHaveCount(0);
  await expect(bloque).toHaveAttribute("aria-label", /2 de 2 inscritos/);
  await expect(bloque).toContainText("Llena");
});
