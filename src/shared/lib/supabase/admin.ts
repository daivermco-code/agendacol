import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Cliente con la llave service_role. Solo para crear o quitar usuarios de la demo desde Server Actions
 * que ya revisaron el permiso `gestionar_usuarios`. Nunca llega al navegador y solo corre contra Supabase local.
 */
export function crearClienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !llave)
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en .env.local");
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url))
    throw new Error("El cliente admin solo se usa con Supabase local");
  return createClient<Database>(url, llave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
