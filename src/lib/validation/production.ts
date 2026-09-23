import { z } from "zod";

export const productionItemSchema = z.object({
  product_id: z.string().uuid("Producto inválido"),
  qty: z.number().positive("La cantidad debe ser mayor a cero"),
});

export const registerProductionSchema = z.object({
  warehouse_id: z.string().uuid("Bodega inválida"),
  product_id: z.string().uuid("Producto terminado inválido"),
  output_qty: z.number().positive("La cantidad a producir debe ser mayor a cero"),
  consumptions: z.array(productionItemSchema).min(1, "Debe incluir al menos un insumo"),
});

export type RegisterProductionInput = z.infer<typeof registerProductionSchema>;
