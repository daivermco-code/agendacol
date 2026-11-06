// Imágenes de arranque del iPhone y el iPad (apple-touch-startup-image): lo que muestra iOS al abrir la app
// instalada, antes de que llegue la página. Sin ellas sale una pantalla negra. El iPhone la deja hasta que la
// página se pinta y de ahí pasa directo a la app: no hay otra pantalla de bienvenida dentro de la página (con una
// azul encima, el destello blanco que pone iOS en ese cambio se notaba). `barra` es el alto aproximado de la barra
// de estado de cada modelo (solo pinta la franja negra de arriba). Uso: `node scripts/imagenes-arranque.mjs`
// (necesita internet para Figtree). Las imágenes van a `public/iconos/arranque/`, que se lee sin sesión.
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const pantallas = JSON.parse(
  readFileSync(join(raiz, "src/shared/lib/arranque-ios.json"), "utf8"),
);
const destino = join(raiz, "public/iconos/arranque");
mkdirSync(destino, { recursive: true });

const html = `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@700&display=block" rel="stylesheet">
<style>
  /* El logo y el nombre, centrados en la pantalla entera. La franja negra de arriba es solo la barra de estado
     (con statusBarStyle "black" la app la muestra negra). */
  html { margin: 0; height: 100%; background: #13233A; }
  body { position: fixed; inset: 0; margin: 0;
         display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px;
         font-family: Figtree, sans-serif; }
  #barra { position: fixed; top: 0; left: 0; right: 0; height: var(--barra); background: #000; }
  svg { width: 88px; height: 88px; }
  span { font-size: 30px; font-weight: 700; letter-spacing: -0.025em; color: #F3F6F9; line-height: 1.5; }
  b { color: #5FD3C6; font-weight: 700; }
</style></head><body>
<div id="barra"></div>
<svg viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#0B7A70"/>
  <path d="M23.2 10.4A9 9 0 1 0 23.2 21.6" fill="none" stroke="#FEFEFF" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M12.2 16.4l3 3 5.6-6.6" fill="none" stroke="#FEFEFF" stroke-width="2.6" stroke-linecap="round"
        stroke-linejoin="round"/>
</svg>
<span id="nombre">Agenda<b>Col</b></span>
</body></html>`;

const navegador = await chromium.launch();

// 1) El nombre solo, sin fondo, a escala 3, para que todas las imágenes lo lleven igual.
const paginaNombre = await navegador.newPage({ deviceScaleFactor: 3 });
await paginaNombre.setContent(html, { waitUntil: "networkidle" });
await paginaNombre.evaluate(async () => {
  document.documentElement.style.background = "transparent";
  document.body.style.background = "transparent";
  await document.fonts.ready;
});
const nombre = paginaNombre.locator("#nombre");
const caja = await nombre.boundingBox();
const png = await nombre.screenshot({ omitBackground: true });
await paginaNombre.close();
const src = `data:image/png;base64,${png.toString("base64")}`;
const ancho = +caja.width.toFixed(2);
const alto = +caja.height.toFixed(2);

// 2) Una imagen de arranque por pantalla, con el nombre como imagen.
const conImagen = html.replace(
  '<span id="nombre">Agenda<b>Col</b></span>',
  `<img src="${src}" width="${Math.round(ancho)}" height="${Math.round(alto)}" style="width:${ancho}px;height:${alto}px" alt="">`,
);
for (const pantalla of pantallas) {
  const pagina = await navegador.newPage({
    viewport: { width: pantalla.ancho, height: pantalla.alto },
    deviceScaleFactor: pantalla.escala,
  });
  await pagina.setContent(conImagen, { waitUntil: "load" });
  await pagina.evaluate((barra) => {
    document.documentElement.style.setProperty("--barra", `${barra}px`);
  }, pantalla.barra);
  const archivo = `arranque-${pantalla.ancho * pantalla.escala}x${pantalla.alto * pantalla.escala}.png`;
  await pagina.screenshot({ path: join(destino, archivo) });
  await pagina.close();
  console.log(archivo);
}
await navegador.close();
