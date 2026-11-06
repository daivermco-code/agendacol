import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { clienteServicio, NEGOCIO_DEMO } from "../integracion/ayuda";
import { ahoraEnZona } from "../../src/features/agenda/lib/fechas";

// Tarjeta de sellos de punta a punta: un cliente con 7 de 8 sellos llega a su cita, la dueña la marca «Asiste» en
// la agenda, la tarjeta se llena (con el aviso «¡Completaste tu tarjeta!») y entrega el premio desde Fidelización:
// la tarjeta vuelve a empezar. Cada tamaño usa su cliente y su profesional, con la cita en su día de la semana
// dentro de 7 semanas (lejos de las otras pruebas). Al final se borran sus citas (y con ellas los sellos) y el
// cliente.
type Cliente = SupabaseClient<Database>;

const LOCAL = "a1000000-0000-4000-8000-000000000001";
const CASOS: Record<string, { proId: string; diaSemana: number }> = {
  computador: { proId: "b0000000-0000-4000-8000-000000000001", diaSemana: 2 },
  "tableta-horizontal": {
    proId: "b0000000-0000-4000-8000-000000000002",
    diaSemana: 3,
  },
  "tableta-vertical": {
    proId: "b0000000-0000-4000-8000-000000000003",
    diaSemana: 4,
  },
  celular: { proId: "b0000000-0000-4000-8000-000000000004", diaSemana: 5 },
};
const NOMBRE = "Tarjeta";
const META = 8;

let servicio: Cliente;
let apellido: string;
let clienteId: string;
let citaId: string;
let dia: string;

/** El día de la semana ISO `diaSemana` (1 = lunes) de dentro de `semanas` semanas, en la zona del negocio. */
function diaDentroDe(semanas: number, diaSemana: number): string {
  const d = new Date(`${ahoraEnZona().fecha}T12:00:00Z`);
  const lunes = d.getUTCDate() - ((d.getUTCDay() + 6) % 7);
  d.setUTCDate(lunes + semanas * 7 + diaSemana - 1);
  return d.toISOString().slice(0, 10);
}

function haceDias(dias: number): string {
  const d = new Date(`${ahoraEnZona().fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

async function limpiar() {
  const { data: clientes } = await servicio
    .from("clientes")
    .select("id")
    .eq("apellido", apellido);
  const ids = (clientes ?? []).map((c) => c.id);
  if (!ids.length) return;
  await servicio.from("citas").delete().in("cliente_id", ids);
  await servicio.from("clientes").delete().in("id", ids);
}

test.beforeAll(async ({}, info) => {
  servicio = clienteServicio();
  const caso = CASOS[info.project.name];
  if (!caso) throw new Error(`Sin caso para ${info.project.name}`);
  apellido = `Sellos E2E ${info.project.name}`;
  dia = diaDentroDe(7, caso.diaSemana);
  await limpiar();
  const n = Object.keys(CASOS).indexOf(info.project.name) + 1;
  const { data: s } = await servicio
    .from("servicios")
    .select("id, duracion_min, precio")
    .eq("negocio_id", NEGOCIO_DEMO)
    .eq("nombre", "Corte y barba")
    .single();
  const { data: c } = await servicio
    .from("clientes")
    .insert({
      negocio_id: NEGOCIO_DEMO,
      nombre: NOMBRE,
      apellido,
      correo: `sellos.e2e${n}@ejemplo.test`,
    })
    .select("id")
    .single();
  if (!s || !c)
    throw new Error("Faltan datos de la semilla: corre npm run db:reset");
  clienteId = c.id;
  const cita = (fecha: string, estado: "asiste" | "confirmado") => ({
    negocio_id: NEGOCIO_DEMO,
    local_id: LOCAL,
    cliente_id: clienteId,
    profesional_id: caso.proId,
    servicio_id: s.id,
    fecha,
    hora_inicio: estado === "asiste" ? "05:00" : "16:00",
    hora_fin: estado === "asiste" ? "05:45" : "16:45",
    duracion_min: s.duracion_min,
    precio: s.precio,
    estado,
  });
  // 7 visitas pasadas (cada «Asiste» pone un sello) y la cita que la llena.
  const { error } = await servicio
    .from("citas")
    .insert(
      Array.from({ length: META - 1 }, (_, i) =>
        cita(haceDias(20 + i), "asiste"),
      ),
    );
  const { data: proxima } = await servicio
    .from("citas")
    .insert(cita(dia, "confirmado"))
    .select("id")
    .single();
  if (error || !proxima) throw new Error(error?.message ?? "sin cita");
  citaId = proxima.id;
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

async function verTarjeta(page: Page) {
  await page.goto(`/clientes/${clienteId}`);
  // En el celular la ficha va en plegables (T-12.12): «Sellos» en vez de la pestaña «Fidelización».
  await page
    .getByRole("tab", { name: "Fidelización" })
    .or(page.getByRole("button", { name: "Sellos", exact: true }))
    .click();
}

async function contar(tabla: "sellos" | "canjes_sellos") {
  const { count } = await servicio
    .from(tabla)
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", clienteId);
  return count;
}

test("la tarjeta avanza con «Asiste», se llena y se entrega el premio", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const nombre = `${NOMBRE} ${apellido}`;
  await entrarComo(page, /Dueño/);

  // 1. La ficha del cliente: 7 de 8 sellos.
  await verTarjeta(page);
  await expect(
    page.getByRole("img", { name: `${META - 1} de ${META} sellos` }),
  ).toBeVisible();

  // 2. Llega a su cita: «Asiste» desde la ficha de la cita en la agenda pone el sello 8.
  await page.goto(`/agenda?vista=dia&fecha=${dia}`);
  const bloque = page.locator(`[data-cita="${citaId}"]`);
  await bloque.click();
  await page.getByRole("button", { name: "Cambiar a Asiste" }).click();
  await expect(bloque).toHaveAttribute("aria-label", /Asiste/);
  await expect.poll(() => contar("sellos")).toBe(META);
  const { data: avisos } = await servicio
    .from("avisos_demo")
    .select("asunto, destino")
    .eq("cita_id", citaId)
    .eq("tipo", "sellos");
  expect(avisos).toEqual([
    { asunto: "¡Completaste tu tarjeta!", destino: expect.any(String) },
  ]);

  // 3. La ficha la muestra llena, con el premio por entregar.
  await verTarjeta(page);
  await expect(
    page.getByRole("img", { name: `${META} de ${META} sellos` }),
  ).toBeVisible();
  await expect(
    page.getByText("Tiene un premio por entregar.").filter({ visible: true }),
  ).toBeVisible();

  // 4. Fidelización: entregar el premio; la tarjeta vuelve a empezar.
  await page.goto("/clientes/fidelizacion");
  await page.getByPlaceholder("Buscar cliente").fill(apellido);
  const fila = page.getByRole("listitem").filter({ hasText: nombre });
  await expect(fila.getByText("1 premio por entregar")).toBeVisible();
  await fila.getByRole("button", { name: "Entregar premio" }).click();
  await page
    .getByRole("dialog", { name: `¿Entregar el premio a ${nombre}?` })
    .getByRole("button", { name: "Entregar" })
    .click();
  await expect(aviso(page, `Premio entregado a ${nombre}`)).toBeVisible();
  await expect.poll(() => contar("canjes_sellos")).toBe(1);
  await verTarjeta(page);
  await expect(
    page.getByRole("img", { name: `0 de ${META} sellos` }),
  ).toBeVisible();
  await expect(
    page.getByText("1 entregado", { exact: false }).filter({ visible: true }),
  ).toBeVisible();
});
