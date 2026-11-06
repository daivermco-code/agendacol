import { afterEach, describe, expect, it, vi } from "vitest";
import { nuevoId } from "./id";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("nuevoId", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("usa crypto.randomUUID cuando existe", () => {
    expect(nuevoId()).toMatch(UUID_V4);
  });

  it("sin randomUUID (http en la red de la casa) arma un UUID v4 distinto cada vez", () => {
    const real = globalThis.crypto;
    vi.stubGlobal("crypto", {
      getRandomValues: real.getRandomValues.bind(real),
    });
    const a = nuevoId();
    const b = nuevoId();
    expect(a).toMatch(UUID_V4);
    expect(b).toMatch(UUID_V4);
    expect(a).not.toBe(b);
  });
});
