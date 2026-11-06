import { clienteServicio, NEGOCIO_DEMO } from "../integracion/ayuda";

// Las pruebas de ventas gastan números y después borran sus ventas. Antes de correr se guarda el próximo número
// y al final se devuelve, para que la demo siga sin saltos (o queda en el siguiente del último que exista, si
// alguien vendió mientras tanto).
const CLAVE = "E2E_VENTA_SIGUIENTE";

export async function guardarNumeracion() {
  const { data } = await clienteServicio()
    .from("ajustes")
    .select("venta_siguiente")
    .eq("negocio_id", NEGOCIO_DEMO)
    .single();
  if (!data)
    throw new Error("Sin ajustes del negocio demo: corre npm run db:reset");
  process.env[CLAVE] = String(data.venta_siguiente);
}

export async function devolverNumeracion() {
  const original = Number(process.env[CLAVE]);
  if (!original) return;
  const servicio = clienteServicio();
  const { data: a } = await servicio
    .from("ajustes")
    .select("venta_prefijo")
    .eq("negocio_id", NEGOCIO_DEMO)
    .single();
  const { data: ultima } = await servicio
    .from("ventas")
    .select("correlativo")
    .eq("negocio_id", NEGOCIO_DEMO)
    .eq("prefijo", a?.venta_prefijo ?? "")
    .order("correlativo", { ascending: false })
    .limit(1)
    .maybeSingle();
  const siguiente = Math.max(original, (ultima?.correlativo ?? 0) + 1);
  await servicio
    .from("ajustes")
    .update({ venta_siguiente: siguiente })
    .eq("negocio_id", NEGOCIO_DEMO);
}

export default guardarNumeracion;
