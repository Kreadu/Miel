import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import { isValidStoreSlug } from "./slug";

/**
 * S27-01: datos públicos de una tienda (solo por store_info/store_catalog, nunca tablas).
 * null = no existe o está apagada. `cache`: metadata, página e ícono comparten la consulta.
 */
export const loadStore = cache(async (slug: string) => {
  if (!isValidStoreSlug(slug)) return null;
  const supabase = await createClient();
  const [{ data: info }, { data: products }] = await Promise.all([
    supabase.rpc("store_info", { p_slug: slug }),
    supabase.rpc("store_catalog", { p_slug: slug }),
  ]);
  if (!info?.length) return null;
  return { info: info[0], products: products ?? [] };
});

export type StoreProduct = NonNullable<Awaited<ReturnType<typeof loadStore>>>["products"][number];
export type StoreInfo = NonNullable<Awaited<ReturnType<typeof loadStore>>>["info"];
