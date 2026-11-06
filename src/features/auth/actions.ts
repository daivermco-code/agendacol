"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/shared/lib/supabase/server";
import { USUARIOS_DEMO } from "./demo";
import { esquemaClaveDemo, esquemaEntrar, rutaSegura } from "./schemas";

export type ResultadoEntrar = {
  ok: false;
  error: string;
  campo?: "correo" | "clave";
};

export async function entrar(
  datos: unknown,
  volver?: string,
): Promise<ResultadoEntrar> {
  const parsed = esquemaEntrar.safeParse(datos);
  if (!parsed.success) {
    const problema = parsed.error.issues[0];
    return {
      ok: false,
      error: problema.message,
      campo: problema.path[0] === "clave" ? "clave" : "correo",
    };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.correo,
    password: parsed.data.clave,
  });
  if (error)
    return { ok: false, error: "El correo o la contraseña no coinciden" };

  redirect(rutaSegura(volver));
}

/** "Entrar como" (solo demo): firma con la contraseña de DEMO_PASSWORD, que nunca llega al navegador. */
export async function entrarComo(
  clave: unknown,
  volver?: string,
): Promise<ResultadoEntrar> {
  const parsed = esquemaClaveDemo.safeParse(clave);
  if (!parsed.success)
    return { ok: false, error: "Ese usuario de demo no existe" };

  const contrasena = process.env.DEMO_PASSWORD;
  if (!contrasena)
    return { ok: false, error: "Falta DEMO_PASSWORD en .env.local." };

  const usuario = USUARIOS_DEMO.find((u) => u.clave === parsed.data);
  if (!usuario) return { ok: false, error: "Ese usuario de demo no existe" };

  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword({
    email: usuario.correo,
    password: contrasena,
  });
  if (error)
    return { ok: false, error: "Falta la demo. Ejecuta npm run db:reset." };

  redirect(rutaSegura(volver));
}

export async function salir(): Promise<void> {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/entrar");
}
