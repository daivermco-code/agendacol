import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ahoraEnZona } from "@/features/agenda/lib/fechas";
import type { EstadisticasRecordatorios } from "@/features/recordatorios/types";
import {
  clienteAnonimo,
  clienteComo,
  clienteServicio,
  NEGOCIO_DEMO,
} from "./ayuda";

// Pantalla de recordatorios (0008): quién confirmó cada cita y los números del período. Usa una cita reservada
// de la última semana de la semilla y la deja como estaba.
type Cliente = SupabaseClient<Database>;

let servicio: Cliente;
let duena: Cliente;
let recepcion: Cliente;
let cita: { id: string; token: string; fecha: string };
const avisosPrueba: string[] = [];

beforeAll(async () => {
  servicio = clienteServicio();
  duena = await clienteComo("duena@salonceiba.test");
  recepcion = await clienteComo("recepcion@salonceiba.test");
  const { data } = await servicio
    .from("citas")
    .select("id, token, fecha")
    .eq("negocio_id", NEGOCIO_DEMO)
    .eq("estado", "reservado")
    .is("reserva_id", null)
    .gt("fecha", ahoraEnZona().fecha)
    .order("fecha", { ascending: false })
    .limit(1)
    .single();
  if (!data) throw new Error("Faltan citas reservadas en la semilla");
  cita = data;
});

afterAll(async () => {
  await servicio
    .from("citas")
    .update({ estado: "reservado" })
    .eq("id", cita.id);
  await servicio.from("avisos_demo").delete().in("id", avisosPrueba);
  await servicio
    .from("avisos_demo")
    .delete()
    .eq("cita_id", cita.id)
    .eq("tipo", "respuesta");
});

async function confirmadaPor() {
  const { data } = await servicio
    .from("citas")
    .select("estado, confirmada_por")
    .eq("id", cita.id)
    .single();
  return data;
}

describe("recordatorios", () => {
  it("sin sesión no hay números", async () => {
    const { error } = await clienteAnonimo().rpc("estadisticas_recordatorios", {
      p_desde: cita.fecha,
      p_hasta: cita.fecha,
    });
    expect(error).not.toBeNull();
  });

  it("el equipo confirma desde la agenda y al volver a Reservado se borra", async () => {
    await recepcion.rpc("cambiar_estado_cita", {
      p_cita: cita.id,
      p_estado: "confirmado",
    });
    expect(await confirmadaPor()).toEqual({
      estado: "confirmado",
      confirmada_por: "equipo",
    });
    await recepcion.rpc("cambiar_estado_cita", {
      p_cita: cita.id,
      p_estado: "reservado",
    });
    expect(await confirmadaPor()).toEqual({
      estado: "reservado",
      confirmada_por: null,
    });
  });

  it("el cliente confirma con su enlace (correo)", async () => {
    const { data } = await clienteAnonimo().rpc("publico_confirmar_cita", {
      p_token: cita.token,
    });
    expect((data as { ok: boolean }).ok).toBe(true);
    expect(await confirmadaPor()).toEqual({
      estado: "confirmado",
      confirmada_por: "correo",
    });
    await servicio
      .from("citas")
      .update({ estado: "reservado" })
      .eq("id", cita.id);
  });

  it("responder SÍ al WhatsApp en el buzón la confirma por WhatsApp", async () => {
    const { data: aviso } = await servicio
      .from("avisos_demo")
      .insert({
        negocio_id: NEGOCIO_DEMO,
        cita_id: cita.id,
        canal: "whatsapp",
        tipo: "recordatorio",
        destinatario: "Prueba",
        destino: "+573000000000",
        cuerpo: "Recordatorio de prueba",
        estado: "enviado",
      })
      .select("id")
      .single();
    avisosPrueba.push(aviso!.id);
    const { data } = await recepcion.rpc("responder_aviso_demo", {
      p_aviso: aviso!.id,
    });
    expect((data as { ok: boolean }).ok).toBe(true);
    expect(await confirmadaPor()).toEqual({
      estado: "confirmado",
      confirmada_por: "whatsapp",
    });

    const { data: e } = await duena.rpc("estadisticas_recordatorios", {
      p_desde: cita.fecha,
      p_hasta: cita.fecha,
    });
    const datos = e as unknown as EstadisticasRecordatorios;
    expect(datos.canales.whatsapp.confirmadas).toBeGreaterThanOrEqual(1);
    expect(datos.confirmadas).toBeGreaterThanOrEqual(
      datos.canales.whatsapp.confirmadas,
    );
    expect(datos.cupo.contratados).toBe(300);
  });

  it("las reservas del período cuadran con las citas no canceladas", async () => {
    const { count } = await servicio
      .from("citas")
      .select("id", { count: "exact", head: true })
      .eq("negocio_id", NEGOCIO_DEMO)
      .eq("fecha", cita.fecha)
      .neq("estado", "cancelado");
    const { data } = await duena.rpc("estadisticas_recordatorios", {
      p_desde: cita.fecha,
      p_hasta: cita.fecha,
    });
    expect((data as unknown as EstadisticasRecordatorios).reservas).toBe(count);
  });
});
