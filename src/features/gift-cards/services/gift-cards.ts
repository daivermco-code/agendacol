import "server-only";
import { hoyEnBogota } from "@/features/ventas/services/panel";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import { estadoGiftCard } from "../lib/gift-cards";
import type { ColorGiftCard, GiftCardVendida, ModeloGiftCard } from "../types";

/** Catálogo de gift cards con cuántas se han vendido de cada una. */
export async function listarModelos(): Promise<ModeloGiftCard[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("gift_card_modelos")
    .select(
      "id, nombre, monto, precio, vigencia_dias, color, activo, gift_cards(count)",
    )
    .order("monto");
  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => ({
    id: m.id,
    nombre: m.nombre,
    monto: m.monto,
    precio: m.precio,
    vigenciaDias: m.vigencia_dias,
    color: m.color as ColorGiftCard,
    activo: m.activo,
    vendidas: m.gift_cards[0]?.count ?? 0,
  }));
}

/** Gift cards vendidas, la más nueva primero, con su estado a hoy. */
export async function listarVendidas(): Promise<GiftCardVendida[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("listar_gift_cards");
  if (error) throw new Error(error.message);
  const hoy = hoyEnBogota();
  return (data ?? []).map((g) => {
    const base = {
      anulada: g.anulada,
      vence: g.vence,
      saldo: g.saldo,
      saldoInicial: g.saldo_inicial,
    };
    return {
      id: g.id,
      codigo: g.codigo,
      nombre: g.nombre,
      comprador: g.comprador,
      para: g.para,
      saldoInicial: g.saldo_inicial,
      saldo: g.saldo,
      vence: g.vence,
      venta: g.venta,
      usos: g.usos,
      creada: g.created_at,
      estado: estadoGiftCard(base, hoy),
    };
  });
}
