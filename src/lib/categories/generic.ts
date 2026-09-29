import type { createClient } from "@/lib/supabase/server";

/**
 * S19-15: get-or-create de una categoría de producto por nombre (mismo patrón que el cliente
 * genérico de S19-09) — usada cuando el alta/edición del catálogo trae un nombre de categoría
 * nueva en vez de elegir una existente por id.
 */
export async function getOrCreateCategoryId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  name: string,
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const { data: existing } = await supabase
    .from("product_categories")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("name", trimmed)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from("product_categories")
    .insert({ tenant_id: tenantId, name: trimmed })
    .select("id")
    .single();

  if (error) {
    // Carrera: dos altas simultáneas con el mismo nombre nuevo — el único (tenant_id, name)
    // rechaza la segunda (23505); en vez de fallar, se relee.
    if (error.code === "23505") {
      const { data: retry } = await supabase
        .from("product_categories")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("name", trimmed)
        .maybeSingle();
      return retry?.id ?? null;
    }
    console.error("getOrCreateCategoryId:", error.code);
    return null;
  }

  return created?.id ?? null;
}
