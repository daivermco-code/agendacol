"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { esquemaInvitar } from "./schemas";
import {
  miembroQuePuede,
  primerError,
  SIN_PERMISO,
} from "@/shared/lib/acciones";
import { crearClienteAdmin } from "@/shared/lib/supabase/admin";
import { crearClienteServidor } from "@/shared/lib/supabase/server";

type Resultado = { ok: true } | { ok: false; error: string; code?: string };

export async function invitarUsuario(entrada: unknown): Promise<Resultado> {
  const miembro = await miembroQuePuede("gestionar_usuarios");
  if (!miembro) return SIN_PERMISO;
  const p = esquemaInvitar.safeParse(entrada);
  if (!p.success) return primerError(p.error.issues);
  const clave = process.env.DEMO_PASSWORD;
  if (!clave) return { ok: false, error: "Falta DEMO_PASSWORD en .env.local" };

  const admin = crearClienteAdmin();
  const { data: creado, error } = await admin.auth.admin.createUser({
    email: p.data.correo,
    password: clave,
    email_confirm: true,
    user_metadata: { nombre: p.data.nombre },
  });
  if (error || !creado.user) {
    return {
      ok: false,
      error: error?.message.includes("already")
        ? "Ya existe un usuario con ese correo"
        : "No se pudo crear el usuario",
    };
  }

  const supabase = await crearClienteServidor();
  const { error: e2 } = await supabase.from("miembros").insert({
    negocio_id: miembro.negocioId,
    user_id: creado.user.id,
    nombre: p.data.nombre,
    correo: p.data.correo,
    rol: p.data.rol,
    profesional_id: p.data.rol === "profesional" ? p.data.profesionalId : null,
  });
  if (e2) {
    await admin.auth.admin.deleteUser(creado.user.id);
    return { ok: false, error: "No se pudo dar acceso al usuario" };
  }

  await supabase.from("avisos_demo").insert({
    negocio_id: miembro.negocioId,
    canal: "correo",
    tipo: "invitacion",
    destinatario: p.data.nombre,
    destino: p.data.correo,
    asunto: `Te invitaron a ${miembro.negocioNombre} en AgendaCol`,
    cuerpo: `Hola, ${p.data.nombre}.\n\n${miembro.nombre} te dio acceso a la agenda de ${miembro.negocioNombre}. Entra con este correo y la contraseña de la demo.\n\nEste correo es simulado: en la demo no sale nada de tu computador.`,
  });

  revalidatePath("/usuarios");
  return { ok: true };
}

async function quedaOtroDueno(
  negocioId: string,
  sinMiembro: string,
): Promise<boolean> {
  const supabase = await crearClienteServidor();
  const { count } = await supabase
    .from("miembros")
    .select("id", { count: "exact", head: true })
    .eq("negocio_id", negocioId)
    .eq("rol", "dueno")
    .neq("id", sinMiembro);
  return (count ?? 0) > 0;
}

export async function quitarUsuario(miembroId: unknown): Promise<Resultado> {
  const yo = await miembroQuePuede("gestionar_usuarios");
  if (!yo) return SIN_PERMISO;
  const id = z.string().uuid().safeParse(miembroId);
  if (!id.success) return { ok: false, error: "Usuario no válido" };

  const supabase = await crearClienteServidor();
  const { data: otro } = await supabase
    .from("miembros")
    .select("id, user_id, rol")
    .eq("id", id.data)
    .maybeSingle();
  if (!otro) return { ok: false, error: "Ese usuario ya no existe" };
  if (otro.user_id === yo.userId)
    return { ok: false, error: "No puedes quitarte a ti mismo" };
  if (otro.rol === "dueno" && !(await quedaOtroDueno(yo.negocioId, otro.id))) {
    return { ok: false, error: "Debe quedar al menos un dueño" };
  }

  const { error } = await supabase.from("miembros").delete().eq("id", otro.id);
  if (error) return { ok: false, error: "No se pudo quitar el acceso" };
  await crearClienteAdmin().auth.admin.deleteUser(otro.user_id);
  revalidatePath("/usuarios");
  return { ok: true };
}
