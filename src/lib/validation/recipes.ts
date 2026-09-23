import { z } from "zod";

export const recipeItemSchema = z.object({
  component_product_id: z.string().uuid("Producto inválido"),
  qty: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
});

export const recipeSchema = z.array(recipeItemSchema).min(1, "La receta debe tener al menos un componente");

export type RecipeItemInput = z.infer<typeof recipeItemSchema>;
