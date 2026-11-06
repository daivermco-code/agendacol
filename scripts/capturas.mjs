// Capturas de toda la app en los 4 tamaños de las pruebas y a 375 px, para comparar antes y después de un cambio
// de diseño. Uso, con el build corriendo (`npm run build` + `npm run start`) y Supabase arriba:
//   node scripts/capturas.mjs capturas/antes
// En modo noche (prefers-color-scheme: dark): MODO=dark node scripts/capturas.mjs <carpeta>
// Después se comparan con: python scripts/comparar-capturas.py <carpeta antes> <carpeta después>
// Solo lee: entra como Dueño, recorre las pantallas y abre dos ventanas sin guardar nada.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, devices } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3010";
const MODO = process.env.MODO === "dark" ? "dark" : "light";
const SALIDA = process.argv[2];
if (!SALIDA) {
  console.error(
    "Falta la carpeta de salida: node scripts/capturas.mjs <carpeta>",
  );
  process.exit(1);
}

const TAMANOS = [
  { nombre: "computador", viewport: { width: 1440, height: 900 } },
  { nombre: "tableta-horizontal", viewport: { width: 1180, height: 820 } },
  {
    nombre: "tableta-vertical",
    viewport: { width: 820, height: 1180 },
    hasTouch: true,
  },
  {
    nombre: "celular",
    ...devices["Pixel 7"],
    viewport: { width: 390, height: 844 },
  },
  {
    nombre: "celular-375",
    ...devices["Pixel 7"],
    viewport: { width: 375, height: 812 },
  },
];

// Las de tests/e2e/pantallas.ts (Dueño ve todas), sin la ruta que no existe. Si se agrega una allí, va aquí también.
const PANTALLAS = [
  "/",
  "/avisos",
  "/primeros-pasos",
  "/ajustes",
  "/agenda",
  "/agenda?vista=dia",
  "/agenda?vista=3dias",
  "/agenda?vista=mes",
  "/agenda?vista=lista",
  "/clientes",
  "/clientes/fidelizacion",
  "/clientes/lista-espera",
  "/clientes/marketing",
  "/clientes/recordatorios",
  "/ventas/caja",
  "/ventas/cobros",
  "/ventas/detalle",
  "/ventas/transacciones",
  "/ventas/gift-cards",
  "/ventas/planes",
  "/reportes/reservas",
  "/reportes/reservas?vista=historial",
  "/reportes/reservas?vista=rendimiento",
  "/reportes/ventas",
  "/administracion/servicios",
  "/administracion/profesionales",
  "/administracion/recursos",
  "/administracion/locales",
  "/administracion/productos",
  "/administracion/gift-cards",
  "/administracion/planes",
  "/administracion/numeracion",
  "/administracion/whatsapp",
  "/ajustes/mi-negocio",
  "/ajustes/agenda",
  "/ajustes/recordatorios",
  "/ajustes/caja",
  "/ajustes/sitio-web",
  "/ajustes/ficha-clientes",
  "/ajustes/pagos-en-linea",
  "/ajustes/integraciones",
  "/ajustes/avanzadas",
  "/usuarios",
  "/demo/buzon",
];

// Sin sesión.
const PUBLICAS = ["/entrar", "/reservar/salon-ceiba"];

// Ventanas: se abren con un botón y no se guarda nada.
const VENTANAS = [
  {
    nombre: "ventana-nuevo-cliente",
    ruta: "/clientes",
    boton: /Nuevo cliente/i,
  },
  {
    nombre: "ventana-nuevo-servicio",
    ruta: "/administracion/servicios",
    boton: /Nuevo servicio/i,
  },
];

// Quieto: sin animaciones, sin cursor que parpadea y sin el indicador de Next.
const QUIETO = `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}
nextjs-portal{display:none!important}`;

const archivo = (ruta) =>
  ruta === "/" ? "inicio" : ruta.slice(1).replace(/[/?=&]+/g, "_");

async function esperar(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.addStyleTag({ content: QUIETO }).catch(() => {});
  // Los gráficos se dibujan al entrar en pantalla: bajar y volver arriba.
  await page.evaluate(async () => {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 400));
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1200);
}

async function foto(page, carpeta, nombre) {
  await page.screenshot({
    path: join(carpeta, `${nombre}.png`),
    fullPage: true,
  });
}

const navegador = await chromium.launch();
let total = 0;
for (const { nombre, ...opciones } of TAMANOS) {
  const carpeta = join(SALIDA, nombre);
  mkdirSync(carpeta, { recursive: true });
  const contexto = await navegador.newContext({
    ...opciones,
    baseURL: BASE,
    locale: "es-CO",
    timezoneId: "America/Bogota",
    reducedMotion: "reduce",
    colorScheme: MODO,
  });
  const page = await contexto.newPage();

  for (const ruta of PUBLICAS) {
    await page.goto(ruta);
    await esperar(page);
    await foto(page, carpeta, `publico-${archivo(ruta)}`);
    total++;
  }

  await page.goto("/entrar");
  await page.getByRole("button", { name: /Dueño/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));
  // Que la agenda abra igual en cada corrida y que no salga el globo de Primeros pasos.
  await page.evaluate(() => localStorage.clear());

  for (const ruta of PANTALLAS) {
    await page.goto(ruta);
    await esperar(page);
    await foto(page, carpeta, archivo(ruta));
    total++;
  }

  for (const v of VENTANAS) {
    await page.goto(v.ruta);
    await esperar(page);
    const boton = page.getByRole("button", { name: v.boton }).first();
    if (await boton.isVisible().catch(() => false)) {
      await boton.click();
      await page
        .getByRole("dialog")
        .waitFor()
        .catch(() => {});
      await page.waitForTimeout(600);
      await page.screenshot({ path: join(carpeta, `${v.nombre}.png`) });
      total++;
    } else {
      console.warn(`${nombre}: no encontré el botón de ${v.nombre}`);
    }
  }

  await contexto.close();
  console.log(`${nombre}: listo`);
}
await navegador.close();
console.log(`${total} capturas en ${SALIDA}`);
