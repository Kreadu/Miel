import { z } from "zod";

export const recipeItemSchema = z.object({
  component_product_id: z.string().uuid("stock.errors.productInvalid"),
  qty: z.coerce.number().positive("recipes.errors.qtyPositive"),
});

export const recipeSchema = z.array(recipeItemSchema).min(1, "recipes.errors.componentsRequired");

export type RecipeItemInput = z.infer<typeof recipeItemSchema>;
