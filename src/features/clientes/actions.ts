"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  miembroQuePuede,
  SIN_PERMISO,
  type ResultadoAccion,
} from "@/shared/lib/acciones";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import type { Database } from "@/types/database";
import {
  programaSellos,
  sellosDeCliente,
} from "@/features/fidelizacion/services/fidelizacion";
import { hoyEnBogota } from "@/features/ventas/services/panel";
import type { ClienteLista } from "./lib/lista-celular";
import {
  esquemaCliente,
  esquemaClienteRapido,
  type ClienteResumen,
} from "./schemas";
import { fichaCliente, listaCelular } from "./services/clientes";

type FilaCliente = Database["public"]["Tables"]["clientes"]["Row"];

export type ResultadoCliente =
  | { ok: true; cliente: ClienteResumen }
  | { ok: false; duplicados: ClienteResumen[] }
  | { ok: false; error: string; campo?: string };

const COLUMNAS =
  "id, nombre, apellido, documento, correo, telefono, created_at";

function aResumen(
  c: Pick<
    FilaCliente,
    | "id"
    | "nombre"
    | "apellido"
    | "documento"
    | "correo"
    | "telefono"
    | "created_at"
  >,
): ClienteResumen {
  return {
    id: c.id,
    nombre: c.nombre,
    apellido: c.apellido,
    documento: c.documento,
    correo: c.correo,
    telefono: c.telefono,
    creado: c.created_at,
  };
}

/** ilike sin comodines: compara sin mayúsculas, sin que % o _ del texto cuenten como comodín. */
const exacto = (t: string) => t.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Buscador de la ventana de reserva: nombre, documento, correo o teléfono (mínimo 2 letras). */
export async function buscarClientes(
  texto: unknown,
): Promise<ClienteResumen[]> {
  const t = z.string().trim().min(2).max(60).safeParse(texto);
  if (!t.success || !(await miembroQuePuede("ver_clientes"))) return [];
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("buscar_clientes", { p_texto: t.data });
  return (data ?? []).map(aResumen);
}

/** Mismo correo, teléfono, documento o nombre completo (sin contar al propio cliente si se edita). */
async function duplicados(
  d: Pick<
    z.output<typeof esquemaClienteRapido>,
    "id" | "nombre" | "apellido" | "correo" | "telefono" | "documento"
  >,
): Promise<ClienteResumen[]> {
  const supabase = await crearClienteServidor();
  const base = () => supabase.from("clientes").select(COLUMNAS).limit(3);
  const consultas = [
    base()
      .ilike("nombre", exacto(d.nombre))
      .ilike("apellido", exacto(d.apellido)),
  ];
  if (d.correo) consultas.push(base().eq("correo", d.correo));
  if (d.telefono) consultas.push(base().eq("telefono", d.telefono));
  if (d.documento) consultas.push(base().eq("documento", d.documento));
  const resultados = await Promise.all(consultas);
  const vistos = new Map<string, ClienteResumen>();
  for (const r of resultados)
    for (const c of r.data ?? [])
      if (c.id !== d.id) vistos.set(c.id, aResumen(c));
  return [...vistos.values()].slice(0, 3);
}

/**
 * Crea un cliente (o completa uno existente) desde la reserva. Antes de crear, devuelve los posibles
 * duplicados para que la persona elija; `crearIgual` los ignora.
 */
export async function guardarClienteRapido(
  datos: unknown,
  crearIgual = false,
): Promise<ResultadoCliente> {
  const miembro = await miembroQuePuede("editar_clientes");
  if (!miembro)
    return { ok: false, error: "No tienes permiso para hacer esto" };
  const p = esquemaClienteRapido.safeParse(datos);
  if (!p.success) {
    const i = p.error.issues[0];
    return {
      ok: false,
      error: i?.message ?? "Revisa los datos",
      campo: String(i?.path[0] ?? ""),
    };
  }
  const d = p.data;
  if (!d.id && !crearIgual) {
    const parecidos = await duplicados(d);
    if (parecidos.length) return { ok: false, duplicados: parecidos };
  }

  const fila = {
    nombre: d.nombre,
    apellido: d.apellido,
    documento: d.documento || null,
    correo: d.correo || null,
    telefono: d.telefono || null,
  };
  const supabase = await crearClienteServidor();
  const consulta = d.id
    ? supabase.from("clientes").update(fila).eq("id", d.id)
    : supabase
        .from("clientes")
        .insert({ ...fila, negocio_id: miembro.negocioId });
  const { data, error } = await consulta.select(COLUMNAS).single();
  if (error || !data)
    return {
      ok: false,
      error: "No se pudo guardar el cliente. Intenta de nuevo.",
    };
  return { ok: true, cliente: aResumen(data) };
}

/**
 * Nuevo o editar desde Clientes (ficha completa). Igual que en la reserva, antes de crear ofrece los parecidos
 * (mismo nombre, correo, teléfono o documento) para abrirlos en vez de duplicar.
 */
export async function guardarCliente(
  datos: unknown,
  crearIgual = false,
): Promise<ResultadoCliente> {
  const miembro = await miembroQuePuede("editar_clientes");
  if (!miembro)
    return { ok: false, error: "No tienes permiso para hacer esto" };
  const p = esquemaCliente.safeParse(datos);
  if (!p.success) {
    const i = p.error.issues[0];
    return {
      ok: false,
      error: i?.message ?? "Revisa los datos",
      campo: String(i?.path[0] ?? ""),
    };
  }
  const d = p.data;
  if (!d.id && !crearIgual) {
    const parecidos = await duplicados(d);
    if (parecidos.length) return { ok: false, duplicados: parecidos };
  }

  const fila = {
    nombre: d.nombre,
    apellido: d.apellido,
    documento: d.documento || null,
    correo: d.correo || null,
    telefono: d.telefono || null,
    fecha_nacimiento: d.fechaNacimiento || null,
    genero: d.genero || null,
    numero_cliente: d.numeroCliente || null,
    direccion: d.direccion || null,
    barrio: d.barrio || null,
    municipio: d.municipio || null,
  };
  const supabase = await crearClienteServidor();
  const consulta = d.id
    ? supabase.from("clientes").update(fila).eq("id", d.id)
    : supabase
        .from("clientes")
        .insert({ ...fila, negocio_id: miembro.negocioId });
  const { data, error } = await consulta.select(COLUMNAS).single();
  if (error || !data)
    return {
      ok: false,
      error: "No se pudo guardar el cliente. Intenta de nuevo.",
    };
  revalidatePath("/clientes");
  return { ok: true, cliente: aResumen(data) };
}

/** Borra un cliente sin historia. Con citas o ventas la base lo impide (llave foránea) y se avisa. */
export async function borrarCliente(id: unknown): Promise<ResultadoAccion> {
  if (!(await miembroQuePuede("editar_clientes"))) return SIN_PERMISO;
  const p = z.string().uuid().safeParse(id);
  if (!p.success) return { ok: false, error: "Cliente no válido" };
  const supabase = await crearClienteServidor();
  const { error, count } = await supabase
    .from("clientes")
    .delete({ count: "exact" })
    .eq("id", p.data);
  if (error?.code === "23503")
    return { ok: false, error: "Tiene historial; no se puede borrar" };
  if (error || !count)
    return { ok: false, error: "No se pudo borrar el cliente" };
  revalidatePath("/clientes");
  return { ok: true };
}

/** Siguiente página de la lista A–Z del celular (la primera llega con la página). */
export async function masClientesCelular(
  q: unknown,
  pagina: unknown,
): Promise<
  | { ok: true; filas: ClienteLista[]; total: number }
  | { ok: false; error: string }
> {
  if (!(await miembroQuePuede("ver_clientes"))) return SIN_PERMISO;
  const p = z
    .object({
      q: z.string().trim().max(60),
      pagina: z.number().int().min(2).max(1000),
    })
    .safeParse({ q, pagina });
  if (!p.success) return { ok: false, error: "Búsqueda no válida" };
  try {
    return { ok: true, ...(await listaCelular(p.data.q, p.data.pagina)) };
  } catch {
    return { ok: false, error: "No pudimos cargar más clientes" };
  }
}

/** Todo lo de la ficha para la hoja del celular: datos, reservas, ventas y sellos. */
export async function cargarFichaCliente(id: unknown) {
  if (!(await miembroQuePuede("ver_clientes"))) return SIN_PERMISO;
  const p = z.string().uuid().safeParse(id);
  if (!p.success) return { ok: false as const, error: "Cliente no válido" };
  const [ficha, programa, cuenta] = await Promise.all([
    fichaCliente(p.data),
    programaSellos(),
    sellosDeCliente(p.data),
  ]);
  if (!ficha) return { ok: false as const, error: "Este cliente ya no existe" };
  return {
    ok: true as const,
    ficha,
    hoy: hoyEnBogota(),
    sellos: { programa, ...cuenta },
  };
}
