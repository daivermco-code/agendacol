import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Cliente sin sesión para el sitio de reservas y el enlace del cliente. Solo puede llamar a las funciones
 * publico_* (anon no tiene permisos sobre las tablas); corre en el servidor para que el freno de reservas valga.
 */
export function crearClientePublico() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
