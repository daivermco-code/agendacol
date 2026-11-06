import { describe, expect, it } from "vitest";
import { clienteAnonimo, clienteComo, NEGOCIO_DEMO } from "./ayuda";

describe("RLS por rol (base local)", () => {
  it("anónimo no lee ninguna tabla", async () => {
    const { data, error } = await clienteAnonimo()
      .from("servicios")
      .select("id");
    expect(error?.code === "42501" || (data ?? []).length === 0).toBe(true);
  });

  it("anónimo solo corre las funciones publico_*", async () => {
    const anon = clienteAnonimo();
    const internas = await Promise.all([
      anon.rpc("hhmm", { p: "09:30" }),
      anon.rpc("fecha_larga", { p_fecha: "2026-11-02" }),
      anon.rpc("demo_ids", { clave: "negocio" }),
    ]);
    for (const { error } of internas) expect(error?.code).toBe("42501");
    const { error } = await anon.rpc("publico_negocio", {
      p_slug: "salon-ceiba",
    });
    expect(error).toBeNull();
  });

  it("el dueño lee clientes y escribe ajustes", async () => {
    const duena = await clienteComo("duena@salonceiba.test");
    const { count } = await duena
      .from("clientes")
      .select("id", { count: "exact", head: true });
    expect(count).toBeGreaterThan(0);
    const { data } = await duena
      .from("ajustes")
      .update({ bloque_min: 60 })
      .eq("negocio_id", NEGOCIO_DEMO)
      .select();
    expect(data).toHaveLength(1);
  });

  it("recepción lee clientes pero no escribe ajustes ni catálogo", async () => {
    const recepcion = await clienteComo("recepcion@salonceiba.test");
    const { count } = await recepcion
      .from("clientes")
      .select("id", { count: "exact", head: true });
    expect(count).toBeGreaterThan(0);
    const ajustes = await recepcion
      .from("ajustes")
      .update({ bloque_min: 60 })
      .eq("negocio_id", NEGOCIO_DEMO)
      .select();
    expect(ajustes.data ?? []).toHaveLength(0);
    const servicio = await recepcion
      .from("servicios")
      .update({ nombre: "Cambiado por recepción" })
      .eq("negocio_id", NEGOCIO_DEMO)
      .select();
    expect(servicio.data ?? []).toHaveLength(0);
  });

  it("crear y borrar siguen siendo del dueño (políticas por acción, 0017)", async () => {
    const duena = await clienteComo("duena@salonceiba.test");
    const recepcion = await clienteComo("recepcion@salonceiba.test");
    const nueva = { negocio_id: NEGOCIO_DEMO, nombre: "Prueba RLS" };
    const negada = await recepcion.from("categorias").insert(nueva);
    expect(negada.error?.code).toBe("42501");
    const { data, error } = await duena
      .from("categorias")
      .insert(nueva)
      .select("id")
      .single();
    expect(error).toBeNull();
    const intento = await recepcion
      .from("categorias")
      .delete()
      .eq("id", data!.id)
      .select();
    expect(intento.data ?? []).toHaveLength(0);
    const borrada = await duena
      .from("categorias")
      .delete()
      .eq("id", data!.id)
      .select();
    expect(borrada.data).toHaveLength(1);
  });

  it("el profesional no lee clientes", async () => {
    const carolina = await clienteComo("carolina@salonceiba.test");
    const { data } = await carolina
      .from("clientes")
      .select("id, telefono, correo");
    expect(data ?? []).toHaveLength(0);
  });
});
