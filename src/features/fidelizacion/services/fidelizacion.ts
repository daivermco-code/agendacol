import "server-only";
import { hoyEnBogota } from "@/features/ventas/services/panel";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import { contarSellos, type ProgramaSellos } from "../lib/sellos";
import type { PanelSellos, TarjetaSellos } from "../types";

export async function programaSellos(): Promise<ProgramaSellos> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("ajustes")
    .select("sellos_activos, sellos_meta, sellos_premio")
    .single();
  if (error) throw new Error(error.message);
  return {
    activo: data.sellos_activos,
    meta: data.sellos_meta,
    premio: data.sellos_premio,
  };
}

/** Una tarjeta por cliente con sellos: los que tienen premio por entregar primero, luego el sello más reciente. */
export async function listarTarjetas(meta: number): Promise<TarjetaSellos[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("tarjetas_sellos");
  if (error) throw new Error(error.message);
  const tarjetas = (data ?? []).map((t) => ({
    clienteId: t.cliente_id,
    cliente: t.cliente,
    telefono: t.telefono,
    sellos: t.sellos,
    canjes: t.canjes,
    ultimo: t.ultimo,
    ...contarSellos(t.sellos, t.canjes, meta),
  }));
  return tarjetas.sort(
    (a, b) =>
      Number(b.porEntregar > 0) - Number(a.porEntregar > 0) ||
      b.ultimo.localeCompare(a.ultimo),
  );
}

export async function panelSellos(
  tarjetas: TarjetaSellos[],
  meta: number,
): Promise<PanelSellos> {
  const supabase = await crearClienteServidor();
  const { count, error } = await supabase
    .from("sellos")
    .select("id", { count: "exact", head: true })
    .gte("created_at", `${hoyEnBogota().slice(0, 7)}-01T00:00:00-05:00`);
  if (error) throw new Error(error.message);
  return {
    clientes: tarjetas.length,
    sellosMes: count ?? 0,
    porEntregar: tarjetas.reduce((n, t) => n + t.porEntregar, 0),
    entregados: tarjetas.reduce((n, t) => n + t.canjes, 0),
    aUnSello: tarjetas.filter((t) => t.enTarjeta === meta - 1).length,
  };
}

/** La tarjeta de un cliente para su ficha (sellos y premios entregados). */
export async function sellosDeCliente(
  clienteId: string,
): Promise<{ sellos: number; canjes: number }> {
  const supabase = await crearClienteServidor();
  const [sellos, canjes] = await Promise.all([
    supabase
      .from("sellos")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", clienteId),
    supabase
      .from("canjes_sellos")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", clienteId),
  ]);
  return { sellos: sellos.count ?? 0, canjes: canjes.count ?? 0 };
}
