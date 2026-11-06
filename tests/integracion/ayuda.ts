import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Pruebas contra Supabase local: lee las claves de .env.local (nunca se imprimen).
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin .env.local las pruebas fallan con un mensaje claro abajo.
}

export const NEGOCIO_DEMO = "a0000000-0000-4000-8000-000000000001";

export function clienteAnonimo() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const llave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !llave) throw new Error("Falta .env.local con la URL y la llave anónima de Supabase local");
  return createClient<Database>(url, llave, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function clienteComo(correo: string) {
  const cliente = clienteAnonimo();
  const { error } = await cliente.auth.signInWithPassword({ email: correo, password: process.env.DEMO_PASSWORD ?? "" });
  if (error) throw new Error(`No se pudo entrar como ${correo}: corre npm run db:reset`);
  return cliente;
}

/** Solo para preparar y limpiar datos de prueba (citas de apoyo, ventas creadas por las pruebas). */
export function clienteServicio() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !llave) throw new Error("Falta .env.local con la llave de servicio de Supabase local");
  return createClient<Database>(url, llave, { auth: { persistSession: false, autoRefreshToken: false } });
}
