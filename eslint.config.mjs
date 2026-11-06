import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Configuración oficial de Next 16 (la plantilla traía ESLint sin este archivo).
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // `{ quitar: _quitar, ...resto }` es la forma de omitir una clave; no es una variable olvidada.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    "coverage/**",
    "src/types/database.ts",
  ]),
]);
