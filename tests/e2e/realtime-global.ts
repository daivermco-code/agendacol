import { execFileSync } from "node:child_process";
import path from "node:path";

// Antes de la suite: el tope de Realtime arriba (ver scripts/realtime-tope.mjs). Si Realtime topa sus 100
// mensajes por segundo, deja de avisar los cambios y fallan al azar las pruebas que esperan algo «en vivo».
// Se corre con node aparte: Playwright pasa este archivo a CommonJS y no puede importar el .mjs.
export default function realtimeGlobal() {
  const script = path.resolve(__dirname, "../../scripts/realtime-tope.mjs");
  execFileSync(process.execPath, [script], { stdio: "inherit" });
}
