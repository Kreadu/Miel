"use server";

import { createClient } from "@/lib/supabase/server";
import { recipeSchema } from "@/lib/validation/recipes";
import { revalidatePath } from "next/cache";

export async function saveRecipe(productId: string, rawData: unknown) {
  const result = recipeSchema.safeParse(rawData);

  if (!result.success) {
    return {
      success: false as const,
      errors: result.error.flatten().fieldErrors,
      message: "recipes.errors.checkData",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_recipe", {
    p_product_id: productId,
    p_items: result.data as never,
  });

  if (error) {
    let general = "recipes.errors.saveFailed";
    if (error.message.includes("product_not_finished")) {
      general = "recipes.errors.notFinished";
    } else if (error.message.includes("recipe_qty_invalid")) {
      general = "recipes.errors.qtyPositive";
    } else if (error.message.includes("permission_denied")) {
      general = "common.errors.permissionDenied";
    } else if (error.message.includes("component_tenant_mismatch")) {
      general = "recipes.errors.tenantMismatch";
    }

    return {
      success: false as const,
      errors: {},
      message: general,
    };
  }

  revalidatePath(`/inventario/productos/${productId}/receta`);
  return { success: true as const };
}
