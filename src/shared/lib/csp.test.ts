import { describe, expect, it } from "vitest";
import { nuevoNonce, politicaDeContenido } from "./csp";

function directiva(politica: string, nombre: string): string | undefined {
  return politica
    .split("; ")
    .find((d) => d === nombre || d.startsWith(`${nombre} `));
}

describe("politicaDeContenido", () => {
  const local = politicaDeContenido("abc123", "http://127.0.0.1:44421", false);

  it("los scripts solo corren con el nonce del pedido, sin unsafe-inline ni eval", () => {
    expect(directiva(local, "script-src")).toBe(
      "script-src 'self' 'nonce-abc123' 'strict-dynamic'",
    );
  });

  it("deja hablar con Supabase por http y por el socket de tiempo real", () => {
    expect(directiva(local, "connect-src")).toBe(
      "connect-src 'self' http://127.0.0.1:44421 ws://127.0.0.1:44421",
    );
    expect(directiva(local, "img-src")).toContain("http://127.0.0.1:44421");
  });

  it("no sube a https mientras Supabase sea local", () => {
    expect(directiva(local, "upgrade-insecure-requests")).toBeUndefined();
  });

  it("publicada: socket seguro y pedidos subidos a https", () => {
    const publicada = politicaDeContenido(
      "abc123",
      "https://demo.supabase.co",
      false,
    );
    expect(directiva(publicada, "connect-src")).toBe(
      "connect-src 'self' https://demo.supabase.co wss://demo.supabase.co",
    );
    expect(directiva(publicada, "upgrade-insecure-requests")).toBeDefined();
  });

  it("en desarrollo permite eval (lo usa React para los errores)", () => {
    const desarrollo = politicaDeContenido(
      "abc123",
      "http://127.0.0.1:44421",
      true,
    );
    expect(directiva(desarrollo, "script-src")).toContain("'unsafe-eval'");
  });

  it("no se deja enmarcar ni cargar plugins", () => {
    expect(directiva(local, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directiva(local, "object-src")).toBe("object-src 'none'");
  });
});

describe("nuevoNonce", () => {
  it("cambia en cada pedido", () => {
    expect(nuevoNonce()).not.toBe(nuevoNonce());
  });
});
