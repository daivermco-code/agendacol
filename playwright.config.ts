import { defineConfig, devices } from "@playwright/test";

// Corre contra `npm run dev` (puerto 3010) con Supabase local arriba.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  // Con los 4 tamaños a la vez, el servidor de desarrollo tarda más de 5 s en compilar una ruta nueva.
  expect: { timeout: 10_000 },
  retries: 0,
  // Antes: el tope de Realtime arriba (si topa, deja de avisar los cambios en vivo) y, como las pruebas de ventas
  // gastan números de venta, se guardan para devolverlos al final.
  globalSetup: [
    "./tests/e2e/realtime-global.ts",
    "./tests/e2e/numeracion-global.ts",
  ],
  globalTeardown: "./tests/e2e/numeracion-fin.ts",
  use: {
    baseURL: "http://localhost:3010",
    locale: "es-CO",
    timezoneId: "America/Bogota",
  },
  projects: [
    { name: "computador", use: { viewport: { width: 1440, height: 900 } } },
    {
      name: "tableta-horizontal",
      use: { viewport: { width: 1180, height: 820 } },
    },
    {
      name: "tableta-vertical",
      use: { viewport: { width: 820, height: 1180 }, hasTouch: true },
    },
    {
      name: "celular",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3010/entrar",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
