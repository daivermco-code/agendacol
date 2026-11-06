import "server-only";
import { z } from "zod";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import type { Database } from "@/types/database";
import type { ClienteLista } from "../lib/lista-celular";

type EstadoCita = Database["public"]["Enums"]["estado_cita"];

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .catch("");

/** Filtros de la base de clientes, leídos de la dirección (?q=…&pagina=…). Lo que no sirve se ignora. */
export const esquemaFiltrosClientes = z.object({
  q: z.string().trim().max(60).catch(""),
  pagina: z.coerce.number().int().min(1).catch(1),
  por: z.coerce
    .number()
    .refine((n) => [25, 50, 100].includes(n))
    .catch(25),
  orden: z
    .enum(["nombre", "apellido", "correo", "telefono", "documento"])
    .catch("apellido"),
  dir: z.enum(["asc", "desc"]).catch("asc"),
  profesional: z.string().uuid().or(z.literal("")).catch(""),
  servicio: z.string().uuid().or(z.literal("")).catch(""),
  estado: z
    .enum([
      "",
      "reservado",
      "confirmado",
      "asiste",
      "no_asistio",
      "pendiente",
      "en_espera",
      "cancelado",
    ])
    .catch(""),
  genero: z.enum(["", "femenino", "masculino", "otro"]).catch(""),
  cumpleDesde: fecha,
  cumpleHasta: fecha,
  creadoDesde: fecha,
  creadoHasta: fecha,
  reservo: z.enum(["", "si", "no"]).catch(""),
});
export type FiltrosClientes = z.output<typeof esquemaFiltrosClientes>;

export interface FilaCliente {
  id: string;
  nombre: string;
  apellido: string;
  correo: string | null;
  telefono: string | null;
  documento: string | null;
}

/** Página de la base de clientes (listar_clientes en la base: filtros, orden y total). */
export async function listarClientes(
  f: FiltrosClientes,
): Promise<{ filas: FilaCliente[]; total: number }> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("listar_clientes", {
    p: {
      texto: f.q,
      profesionalId: f.profesional,
      servicioId: f.servicio,
      estado: f.estado,
      genero: f.genero,
      cumpleDesde: f.cumpleDesde,
      cumpleHasta: f.cumpleHasta,
      creadoDesde: f.creadoDesde,
      creadoHasta: f.creadoHasta,
      haReservado: f.reservo === "" ? "" : f.reservo === "si",
      orden: f.orden,
      dir: f.dir,
      limite: f.por,
      pagina: f.pagina,
    },
  });
  if (error) throw new Error(error.message);
  return {
    filas: data.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      correo: c.correo,
      telefono: c.telefono,
      documento: c.documento,
    })),
    total: Number(data[0]?.total ?? 0),
  };
}

/** Clientes por página en la lista del celular (el tope de listar_clientes). */
export const POR_PAGINA_CELULAR = 100;

/** Lista A–Z del celular: por nombre, de a 100, con la misma búsqueda de la tabla (nombre, documento, correo o teléfono). */
export async function listaCelular(
  q: string,
  pagina: number,
): Promise<{ filas: ClienteLista[]; total: number }> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("listar_clientes", {
    p: {
      texto: q,
      orden: "nombre",
      dir: "asc",
      limite: POR_PAGINA_CELULAR,
      pagina,
    },
  });
  if (error) throw new Error("No pudimos cargar los clientes");
  return {
    filas: data.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      correo: c.correo,
    })),
    total: Number(data[0]?.total ?? 0),
  };
}

/** Profesionales y servicios para los filtros avanzados. */
export async function opcionesFiltros() {
  const supabase = await crearClienteServidor();
  const [p, s] = await Promise.all([
    supabase.from("profesionales").select("id, nombre").order("orden"),
    supabase.from("servicios").select("id, nombre").order("nombre"),
  ]);
  return { profesionales: p.data ?? [], servicios: s.data ?? [] };
}

export interface CitaFicha {
  id: string;
  fecha: string;
  horaInicio: string;
  servicio: string;
  profesional: string;
  estado: EstadoCita;
  precio: number;
  pago: "pagada" | "parcial" | "pendiente" | null;
}

export interface VentaFicha {
  id: string;
  numero: string;
  fecha: string;
  total: number;
  pagado: number;
  estado: Database["public"]["Enums"]["estado_venta"];
  detalle: string;
}

/** Todo lo de la ficha del cliente: datos, reservas (con su pago) y ventas. `null` si no existe. */
export async function fichaCliente(id: string) {
  const supabase = await crearClienteServidor();
  const { data: cliente } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!cliente) return null;
  const [citas, ventas] = await Promise.all([
    supabase
      .from("citas")
      .select(
        "id, fecha, hora_inicio, estado, precio, servicios(nombre), profesionales(nombre)",
      )
      .eq("cliente_id", id)
      .order("fecha", { ascending: false })
      .order("hora_inicio", { ascending: false }),
    supabase
      .from("ventas")
      .select(
        "id, numero, created_at, total, pagado, estado, venta_items(cita_id, descripcion, vigente)",
      )
      .eq("cliente_id", id)
      .order("created_at", { ascending: false }),
  ]);
  const pagoDeCita = new Map<string, "pagada" | "parcial">();
  for (const v of ventas.data ?? [])
    for (const i of v.venta_items)
      if (i.cita_id && i.vigente && v.estado !== "anulada")
        pagoDeCita.set(i.cita_id, v.estado === "pagada" ? "pagada" : "parcial");

  const filasCitas: CitaFicha[] = (citas.data ?? []).map((c) => ({
    id: c.id,
    fecha: c.fecha,
    horaInicio: c.hora_inicio.slice(0, 5),
    servicio: c.servicios?.nombre ?? "Servicio",
    profesional: c.profesionales?.nombre ?? "",
    estado: c.estado,
    precio: c.precio,
    pago:
      pagoDeCita.get(c.id) ??
      (c.estado === "asiste" || c.estado === "no_asistio" ? "pendiente" : null),
  }));
  const filasVentas: VentaFicha[] = (ventas.data ?? []).map((v) => ({
    id: v.id,
    numero: v.numero ?? "",
    fecha: v.created_at,
    total: v.total,
    pagado: v.pagado,
    estado: v.estado,
    detalle: v.venta_items.map((i) => i.descripcion).join(", "),
  }));
  return { cliente, citas: filasCitas, ventas: filasVentas };
}
export type FichaCliente = NonNullable<
  Awaited<ReturnType<typeof fichaCliente>>
>;
