import { describe, expect, it } from "vitest";
import { crearConexion, REINTENTO_MS, type Entorno } from "./use-conexion";

/** Un navegador de mentiras: la red, los eventos, el servidor y el reloj se manejan a mano. */
function falso(enLinea = true) {
  const oyentes = {
    online: new Set<() => void>(),
    offline: new Set<() => void>(),
  };
  const esperas: { fn: () => void; ms: number }[] = [];
  let responde = true;
  let reloj = 1_000;
  const entorno: Entorno = {
    enLinea: () => enLinea,
    escuchar: (tipo, fn) => {
      oyentes[tipo].add(fn);
      return () => oyentes[tipo].delete(fn);
    },
    comprobar: async () => responde,
    ahora: () => reloj,
    esperar: (fn, ms) => {
      const e = { fn, ms };
      esperas.push(e);
      return () => esperas.splice(esperas.indexOf(e), 1);
    },
  };
  return {
    entorno,
    oyentes,
    esperas,
    disparar: (tipo: "online" | "offline") => {
      enLinea = tipo === "online";
      oyentes[tipo].forEach((f) => f());
    },
    servidor: (si: boolean) => {
      responde = si;
    },
    avanzar: (ms: number) => {
      reloj += ms;
    },
  };
}

const tic = () => new Promise((r) => setTimeout(r, 0));

describe("crearConexion", () => {
  it("se cae con offline y anota la hora", () => {
    const f = falso();
    const c = crearConexion(f.entorno);
    c.suscribir(() => {});
    expect(c.leer()).toEqual({ enLinea: true, desde: null });
    f.avanzar(500);
    f.disparar("offline");
    expect(c.leer()).toEqual({ enLinea: false, desde: 1_500 });
  });

  it("con online vuelve solo si el servidor responde; si no, reintenta a los 5 s", async () => {
    const f = falso();
    const c = crearConexion(f.entorno);
    c.suscribir(() => {});
    f.disparar("offline");
    f.servidor(false);
    f.disparar("online");
    await tic();
    expect(c.leer().enLinea).toBe(false);
    expect(f.esperas).toHaveLength(1);
    expect(f.esperas[0].ms).toBe(REINTENTO_MS);
    f.servidor(true);
    f.esperas[0].fn();
    await tic();
    expect(c.leer()).toEqual({ enLinea: true, desde: null });
  });

  it("una caída en medio de la comprobación gana", async () => {
    const f = falso();
    const c = crearConexion(f.entorno);
    c.suscribir(() => {});
    f.disparar("offline");
    f.disparar("online");
    f.disparar("offline");
    await tic();
    expect(c.leer().enLinea).toBe(false);
  });

  it("arranca caída si el navegador ya no tiene red y avisa a quien escucha", () => {
    const f = falso(false);
    const c = crearConexion(f.entorno);
    let avisos = 0;
    c.suscribir(() => (avisos += 1));
    expect(c.leer().enLinea).toBe(false);
    f.disparar("offline");
    expect(avisos).toBe(0);
  });

  it("deja de escuchar cuando nadie está suscrito", () => {
    const f = falso();
    const c = crearConexion(f.entorno);
    const soltar = c.suscribir(() => {});
    expect(f.oyentes.offline.size).toBe(1);
    soltar();
    expect(f.oyentes.offline.size).toBe(0);
    expect(f.oyentes.online.size).toBe(0);
  });
});
