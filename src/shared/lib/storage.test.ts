import { describe, expect, it } from "vitest";
import { esFotoDelStorage } from "./storage";

describe("esFotoDelStorage", () => {
  const SUPABASE = "http://127.0.0.1:44421";
  const FOTO = `${SUPABASE}/storage/v1/object/public/servicios/negocio/foto.webp`;

  it("acepta una foto pública del bucket", () => {
    expect(esFotoDelStorage(FOTO, SUPABASE, "servicios")).toBe(true);
  });

  it.each([
    [
      "otro host",
      "https://ejemplo.com/storage/v1/object/public/servicios/a.png",
    ],
    [
      "otro puerto",
      "http://127.0.0.1:9999/storage/v1/object/public/servicios/a.png",
    ],
    ["otro bucket", `${SUPABASE}/storage/v1/object/public/logos/a.png`],
    ["un objeto privado", `${SUPABASE}/storage/v1/object/servicios/a.png`],
    ["parámetros", `${FOTO}?v=2`],
    ["un ancla", `${FOTO}#x`],
    ["texto que no es URL", "foto.png"],
  ])("rechaza %s", (_, url) => {
    expect(esFotoDelStorage(url, SUPABASE, "servicios")).toBe(false);
  });

  it("rechaza todo si falta la URL de Supabase", () => {
    expect(esFotoDelStorage(FOTO, undefined, "servicios")).toBe(false);
  });
});
