import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

let cliente: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Cliente de Supabase para el navegador (agenda con TanStack Query y Realtime). Uno por pestaña. */
export function crearClienteNavegador() {
  cliente ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return cliente;
}
