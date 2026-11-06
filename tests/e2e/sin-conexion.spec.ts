import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { clienteComo, NEGOCIO_DEMO } from "../integracion/ayuda";
import { ahoraEnZona } from "../../src/features/agenda/lib/fechas";

// Red caída (Fase 11, T-11.8): con la app abierta se sigue viendo lo cargado y nada se guarda sin red. Semanas
// 23–24, apellido "SinRed E2E <tamaño>". El aviso en los 4 tamaños; la lógica, en computador y celular.

const LOCAL = "a1000000-0000-4000-8000-000000000001";
const VALENTINA = "b0000000-0000-4000-8000-000000000003";
const DIA_DEL_TAMANO: Record<string, number> = {
  computador: 0,
  "tableta-horizontal": 1,
  "tableta-vertical": 2,
  celular: 3,
};

let recepcion: SupabaseClient<Database>;
let proyecto: string;
let dia: string;
let clienteId: string;
let servicio: { id: string; duracion_min: number; precio: number };

/** Lunes de la semana 23 desde hoy, más el día de este tamaño (cada tamaño en su día). */
function diaDelTamano(n: number): string {
  const d = new Date(`${ahoraEnZona().fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 23 * 7 + n);
  return d.toISOString().slice(0, 10);
}

async function entrarComo(page: Page, rol: RegExp) {
  await page.goto("/entrar");
  await page.getByRole("button", { name: rol }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));
  await page.evaluate(() => localStorage.removeItem("agedacol-agenda"));
}

async function cita(hora: string): Promise<string> {
  const { data, error } = await recepcion.rpc("guardar_cita", {
    p: {
      localId: LOCAL,
      clienteId,
      profesionalId: VALENTINA,
      servicioId: servicio.id,
      fecha: dia,
      horaInicio: hora,
      duracionMin: servicio.duracion_min,
      precio: servicio.precio,
      estado: "reservado",
      forzar: true,
    },
  });
  const r = data as { ok?: boolean; citaIds?: string[] } | null;
  if (error || !r?.ok || !r.citaIds?.[0])
    throw new Error(`No se creó la cita de apoyo de las ${hora}`);
  return r.citaIds[0];
}

/** Lista de espera, citas y avisos, en ese orden; después el cliente. */
async function limpiar() {
  const { data } = await recepcion
    .from("clientes")
    .select("id, correo")
    .eq("apellido", `SinRed E2E ${proyecto}`);
  const ids = (data ?? []).map((c) => c.id);
  if (ids.length === 0) return;
  await recepcion.from("lista_espera").delete().in("cliente_id", ids);
  await recepcion.from("citas").delete().in("cliente_id", ids);
  const correos = (data ?? [])
    .map((c) => c.correo)
    .filter((c): c is string => Boolean(c));
  if (correos.length)
    await recepcion.from("avisos_demo").delete().in("destino", correos);
  await recepcion.from("clientes").delete().in("id", ids);
}

const aviso = (page: Page) =>
  page
    .getByRole("status")
    .filter({ hasText: /^Sin conexión · lo que ves es de las \d{2}:\d{2}$/ });
const toast = (page: Page, texto: string) =>
  page.locator("[data-sonner-toast]").filter({ hasText: texto });

test.beforeAll(async ({}, info) => {
  proyecto = info.project.name;
  dia = diaDelTamano(DIA_DEL_TAMANO[proyecto] ?? 4);
  recepcion = await clienteComo("recepcion@salonceiba.test");
  await limpiar();
  const s = await recepcion
    .from("servicios")
    .select("id, duracion_min, precio")
    .eq("nombre", "Manicure tradicional")
    .single();
  if (!s.data) throw new Error("Falta la semilla: corre npm run db:reset");
  servicio = s.data;
  const c = await recepcion
    .from("clientes")
    .insert({
      negocio_id: NEGOCIO_DEMO,
      nombre: "Prueba",
      apellido: `SinRed E2E ${proyecto}`,
      correo: `sinred.${proyecto}@ejemplo.test`,
    })
    .select("id")
    .single();
  if (!c.data) throw new Error(c.error?.message ?? "No se creó el cliente");
  clienteId = c.data.id;
});

test.afterAll(async () => {
  await limpiar();
});

test("sin red sale el aviso con la hora y se va cuando vuelve", async ({
  page,
  context,
}) => {
  await entrarComo(page, /Recepción/);
  await page.goto("/clientes");
  await expect(
    page.getByRole("heading", { name: "Clientes", level: 1 }).first(),
  ).toBeVisible();
  await context.setOffline(true);
  await expect(aviso(page)).toBeVisible();
  await context.setOffline(false);
  await expect(aviso(page)).toHaveCount(0);
});

test("con la agenda abierta y sin red: se ve lo cargado, nada se guarda y al volver se refresca", async ({
  page,
  context,
}, info) => {
  test.skip(
    !["computador", "celular"].includes(info.project.name),
    "la lógica, en computador y celular",
  );
  const id = await cita("10:00");
  await entrarComo(page, /Recepción/);
  await page.goto(`/agenda?vista=dia&fecha=${dia}`);
  const bloque = page.locator(`[data-cita="${id}"]`);
  await expect(bloque).toBeVisible();

  await context.setOffline(true);
  await expect(aviso(page)).toBeVisible();
  await expect(bloque).toBeVisible();

  // Cambiar el estado sin red: dice que no se guardó y la cita vuelve a su estado.
  await bloque.click();
  await page.getByRole("button", { name: "Cambiar a Confirmado" }).click();
  await expect(toast(page, "Sin conexión: no se guardó")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Estado: Reservado" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar ficha" }).click();
  const { data: guardada } = await recepcion
    .from("citas")
    .select("estado")
    .eq("id", id)
    .single();
  expect(guardada?.estado).toBe("reservado");

  // Un enlace de la app no saca de la pantalla.
  await page.locator('a[href="/"]').filter({ visible: true }).first().click();
  await expect(
    toast(page, "Sin conexión: esta pantalla necesita internet"),
  ).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/agenda");

  // Dos días adelante no se precargó: se dice, y al volver al día cargado la cita sigue ahí.
  const siguiente = page
    .getByRole("button", { name: "Siguiente", exact: true })
    .filter({ visible: true })
    .first();
  await siguiente.click();
  await siguiente.click();
  await expect(
    page.getByText("Sin conexión: este día no está cargado"),
  ).toBeVisible();
  const anterior = page
    .getByRole("button", { name: "Anterior", exact: true })
    .filter({ visible: true })
    .first();
  await anterior.click();
  await anterior.click();
  await expect(bloque).toBeVisible();

  // Lo que se agenda en otro lado mientras no hay red aparece al volver.
  const otra = await cita("11:30");
  await context.setOffline(false);
  await expect(aviso(page)).toHaveCount(0);
  await expect(page.locator(`[data-cita="${otra}"]`)).toBeVisible({
    timeout: 20_000,
  });
});
