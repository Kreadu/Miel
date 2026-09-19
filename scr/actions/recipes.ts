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
      message: "Por favor revisa los datos.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_recipe", {
    p_product_id: productId,
    p_items: result.data as never,
  });

  if (error) {
    let general = "Error al guardar la receta. Intenta de nuevo.";
    if (error.message.includes("product_not_finished")) {
      general = "Solo los productos terminados pueden tener receta.";
    } else if (error.message.includes("recipe_qty_invalid")) {
      general = "Las cantidades deben ser mayores a cero.";
    } else if (error.message.includes("permission_denied")) {
      general = "No tienes permisos para modificar recetas.";
    } else if (error.message.includes("component_tenant_mismatch")) {
      general = "Todos los componentes deben pertenecer a tu empresa.";
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
