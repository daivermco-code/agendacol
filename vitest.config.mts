import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.ts", "tests/integracion/**/*.test.ts"],
    environment: "node",
    // Las pruebas de integración comparten la base local (numeración de ventas, caja): una a la vez.
    fileParallelism: false,
  },
});
