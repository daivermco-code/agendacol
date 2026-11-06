import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  clienteComo,
  clienteServicio,
  NEGOCIO_DEMO,
} from "../integracion/ayuda";
import {
  aHora,
  ahoraEnZona,
  aMinutos,
} from "../../src/features/agenda/lib/fechas";
import { diaCorto } from "../../src/features/reserva-publica/lib/fechas-publicas";

// «Mis citas» y la lista de espera de punta a punta, del lado del cliente sin cuenta: entra con el código que le
// llega (en la demo, al buzón), ve su próxima cita, se anota para que le avisen si se libera una hora en la tarde
// de su día, recepción cancela otra cita de esa tarde, le llega el aviso y lo ve en Mis citas con el enlace a las
// horas; al final se quita de la lista y sale. Cada tamaño usa su profesional y su día de la semana dentro de 4
// semanas (lejos de las otras pruebas), así los 4 corren a la vez.
type Cliente = SupabaseClient<Database>;

interface Caso {
  pro: string;
  proId: string;
  servicio: string;
  diaSemana: number;
}

const SLUG = "salon-ceiba";
const LOCAL = "a1000000-0000-4000-8000-000000000001";
const CASOS: Record<string, Caso> = {
  computador: {
    pro: "Carolina Ruiz",
    proId: "b0000000-0000-4000-8000-000000000001",
    servicio: "Corte de dama",
    diaSemana: 2,
  },
  "tableta-horizontal": {
    pro: "Andrés Molina",
    proId: "b0000000-0000-4000-8000-000000000002",
    servicio: "Corte de caballero",
    diaSemana: 3,
  },
  "tableta-vertical": {
    pro: "Valentina Ospina",
    proId: "b0000000-0000-4000-8000-000000000003",
    servicio: "Manicure tradicional",
    diaSemana: 4,
  },
  celular: {
    pro: "Julián Herrera",
    proId: "b0000000-0000-4000-8000-000000000004",
    servicio: "Arreglo de barba",
    diaSemana: 5,
  },
};

let caso: Caso;
let servicio: Cliente;
let recepcion: Cliente;
let apellido: string;
let correo: string;
let telefono: string;
let dia: string;
let apoyoId: string;

/** El día `diaSemana` de dentro de `semanas` semanas (en la zona del negocio). */
function diaDentroDe(semanas: number): string {
  const d = new Date(`${ahoraEnZona().fecha}T12:00:00Z`);
  const lunes = d.getUTCDate() - ((d.getUTCDay() + 6) % 7);
  d.setUTCDate(lunes + semanas * 7 + caso.diaSemana - 1);
  return d.toISOString().slice(0, 10);
}

async function limpiar() {
  const { data: clientes } = await servicio
    .from("clientes")
    .select("id")
    .eq("apellido", apellido);
  const ids = (clientes ?? []).map((c) => c.id);
  // Primero la lista de espera: borrar las citas del día ya no avisa a nadie.
  if (ids.length) {
    await servicio.from("lista_espera").delete().in("cliente_id", ids);
    await servicio.from("citas").delete().in("cliente_id", ids);
    await servicio.from("clientes").delete().in("id", ids);
  }
  const destinos = [correo, telefono];
  await servicio.from("avisos_demo").delete().in("destino", destinos);
  await servicio.from("codigos_acceso").delete().in("destino", destinos);
  await servicio.from("accesos_cliente").delete().in("destino", destinos);
}

test.beforeAll(async ({}, info) => {
  const elegido = CASOS[info.project.name];
  if (!elegido) throw new Error(`Sin caso para ${info.project.name}`);
  caso = elegido;
  const n = Object.keys(CASOS).indexOf(info.project.name) + 1;
  apellido = `Espera E2E ${info.project.name}`;
  correo = `espera.e2e${n}@ejemplo.test`;
  telefono = `+57300000${9700 + n}`;
  dia = diaDentroDe(4);
  servicio = clienteServicio();
  recepcion = await clienteComo("recepcion@salonceiba.test");
  await limpiar();
  const { data: s } = await servicio
    .from("servicios")
    .select("id, duracion_min, precio")
    .eq("negocio_id", NEGOCIO_DEMO)
    .eq("nombre", caso.servicio)
    .single();
  const { data: clientes } = await servicio
    .from("clientes")
    .insert([
      {
        negocio_id: NEGOCIO_DEMO,
        nombre: "Espera",
        apellido,
        correo,
        telefono,
      },
      { negocio_id: NEGOCIO_DEMO, nombre: "Apoyo", apellido },
    ])
    .select("id, nombre");
  const id = (nombre: string) => clientes?.find((c) => c.nombre === nombre)?.id;
  if (!s || !id("Espera") || !id("Apoyo"))
    throw new Error("Faltan datos de la semilla: corre npm run db:reset");
  const cita = (cliente: string, hora: string) => ({
    negocio_id: NEGOCIO_DEMO,
    local_id: LOCAL,
    cliente_id: cliente,
    profesional_id: caso.proId,
    servicio_id: s.id,
    fecha: dia,
    hora_inicio: hora,
    hora_fin: aHora(aMinutos(hora) + s.duracion_min),
    duracion_min: s.duracion_min,
    precio: s.precio,
    estado: "confirmado" as const,
  });
  const { data: citas, error } = await servicio
    .from("citas")
    .insert([cita(id("Espera")!, "16:00"), cita(id("Apoyo")!, "15:00")])
    .select("id, cliente_id");
  if (error || !citas) throw new Error(error?.message ?? "sin citas");
  apoyoId = citas.find((c) => c.cliente_id === id("Apoyo"))!.id;
});

test.afterAll(async () => {
  await limpiar();
});

const aviso = (page: Page, texto: string) =>
  page.locator("[data-sonner-toast]").filter({ hasText: texto });

/** El código de 6 números del último aviso «Código de acceso» que llegó al correo. */
async function ultimoCodigo(): Promise<string> {
  let codigo = "";
  await expect
    .poll(async () => {
      const { data } = await servicio
        .from("avisos_demo")
        .select("cuerpo")
        .eq("tipo", "codigo")
        .eq("destino", correo)
        .order("created_at", { ascending: false })
        .limit(1);
      codigo = / es (\d{6})\./.exec(data?.[0]?.cuerpo ?? "")?.[1] ?? "";
      return codigo;
    })
    .toMatch(/^\d{6}$/);
  return codigo;
}

async function estadoEspera() {
  const { data } = await servicio
    .from("lista_espera")
    .select("estado, franja, fecha")
    .eq("negocio_id", NEGOCIO_DEMO)
    .eq("fecha", dia)
    .eq("profesional_id", caso.proId)
    .in("estado", ["esperando", "avisado"]);
  return data ?? [];
}

/** En la tira de 7 días, avanza de semana hasta ver el día y lo elige. */
async function irAlDia(page: Page, fecha: string) {
  const { semana, numero } = diaCorto(fecha);
  const boton = page.getByRole("button", {
    name: new RegExp(`^${semana} ${numero}(,|$)`),
  });
  const primero = page
    .getByRole("group", { name: "Días" })
    .getByRole("button")
    .first();
  await expect(primero).toBeVisible();
  for (let i = 0; i < 9 && !(await boton.isVisible()); i++) {
    // Solo el día («Jue 5»): la etiqueta también cambia al terminar de cargar («Jue 5, sin horas libres»), y
    // eso no es otra semana; si cuenta, se adelanta un clic y se salta el día.
    const antes = (await primero.getAttribute("aria-label"))?.split(",")[0];
    await page.getByRole("button", { name: "Semana siguiente" }).click();
    await expect(primero).not.toHaveAttribute(
      "aria-label",
      new RegExp(`^${antes}(,|$)`),
    );
  }
  await boton.click();
}

test("entrar con código, anotarse en la lista de espera y recibir el aviso", async ({
  page,
}) => {
  test.setTimeout(120_000);

  // 1. Desde el sitio, «Mis citas»: pide el código y entra con él.
  await page.goto(`/reservar/${SLUG}`);
  await page.getByRole("link", { name: "Mis citas" }).click();
  await page.waitForURL(/\/mis-citas$/);
  await page.getByLabel("Correo o celular").fill(correo);
  await page.getByRole("button", { name: "Enviarme un código" }).click();
  await page.getByLabel("Código").fill(await ultimoCodigo());
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(
    page.getByRole("heading", { name: "Hola, Espera" }),
  ).toBeVisible();
  await expect(page.getByText(caso.servicio).first()).toBeVisible();

  // 2. Agenda otra cita ese día, pero en la tarde no le sirve ninguna hora: se anota en la lista de espera.
  await page.getByRole("link", { name: "Agendar una cita" }).click();
  await page.getByRole("button", { name: `Agregar ${caso.servicio}` }).click();
  await page.getByRole("button", { name: "Agendar ahora" }).click();
  await page.waitForURL(/\/hora\?/);
  await page.getByRole("radio", { name: caso.pro }).click();
  await irAlDia(page, dia);
  await page
    .getByRole("button", { name: "Avísame si se libera una hora" })
    .click();
  const ventana = page.getByRole("dialog", { name: "Lista de espera" });
  await ventana.getByRole("radio", { name: "En la tarde" }).click();
  await ventana.locator("#espera-nombre").fill("Espera");
  await ventana.locator("#espera-apellido").fill(apellido);
  await ventana.locator("#espera-correo").fill(correo);
  await ventana.locator("#espera-telefono").fill(telefono);
  await ventana.getByRole("checkbox", { name: /Autorizo/ }).click();
  await ventana
    .getByRole("button", { name: "Anotarme en la lista de espera" })
    .click();
  await expect(
    aviso(page, "Listo: te avisaremos si se libera una hora"),
  ).toBeVisible();
  await expect(page.getByText(/Estás en la lista de espera del/)).toBeVisible();
  expect(await estadoEspera()).toEqual([
    { estado: "esperando", franja: "tarde", fecha: dia },
  ]);

  // 3. En Mis citas aparece esperando.
  await page.goto(`/reservar/${SLUG}/mis-citas`);
  const espera = page
    .getByRole("listitem")
    .filter({ hasText: caso.servicio })
    .filter({ hasText: "En la tarde" });
  await expect(espera.getByText("Esperando")).toBeVisible();

  // 4. Recepción cancela otra cita de esa tarde: se libera una hora y le llega el aviso con el enlace.
  const { data: cancelada } = await recepcion.rpc("cancelar_cita", {
    p_cita: apoyoId,
    p_alcance: "solo_esta",
    p_motivo: "Prueba E2E de la lista de espera",
  });
  expect((cancelada as unknown as { ok: boolean }).ok).toBe(true);
  await expect
    .poll(async () => (await estadoEspera())[0]?.estado)
    .toBe("avisado");
  const { data: avisos } = await servicio
    .from("avisos_demo")
    .select("canal, enlace")
    .eq("tipo", "espera")
    .in("destino", [correo, telefono]);
  expect(avisos?.map((a) => a.canal).sort()).toEqual(["correo", "whatsapp"]);

  // 5. Mis citas lo muestra con «Ver horas», que abre las horas de ese día con su profesional.
  await page.reload();
  await expect(espera.getByText("Se liberó una hora")).toBeVisible();
  await espera.getByRole("link", { name: "Ver horas" }).click();
  await page.waitForURL(new RegExp(`/hora\\?.*f=${dia}`));
  expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(
    avisos![0].enlace,
  );
  await expect(page.locator("fieldset button").first()).toBeVisible();

  // 6. Se quita de la lista y sale.
  await page.goto(`/reservar/${SLUG}/mis-citas`);
  await espera
    .getByRole("button", { name: /^Quitarme de la lista de espera/ })
    .click();
  await expect(aviso(page, "Saliste de la lista de espera")).toBeVisible();
  await expect(espera).toHaveCount(0);
  expect(await estadoEspera()).toEqual([]);
  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page.getByLabel("Correo o celular")).toBeVisible();
});
