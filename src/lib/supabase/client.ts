import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";

/** Fábrica única de cliente Supabase de navegador (solo Client Components; uso mínimo). */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
