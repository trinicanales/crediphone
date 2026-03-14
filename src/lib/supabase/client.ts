import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para el navegador — SINGLETON.
 *
 * Se inicializa UNA sola vez a nivel de módulo para evitar el aviso
 * "Multiple GoTrueClient instances detected in the same browser context".
 * Todos los componentes cliente deben importar esta función en lugar de
 * instanciar createBrowserClient directamente.
 */
const supabaseClient = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function createClient() {
  return supabaseClient;
}
