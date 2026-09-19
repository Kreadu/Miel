import { z } from "zod";

export const purchaseItemSchema = z.object({
  product_id: z.uuid("Selecciona un producto válido."),
  qty: z.coerce.number().positive("La cantidad debe ser mayor a cero."),
  unit_cost: z.coerce.number().min(0, "El costo no puede ser negativo."),
  tax_rate: z.coerce.number().min(0).max(100, "El IVA debe estar entre 0 y 100.").default(0),
});

export const purchaseSchema = z.object({
  supplier_id: z.uuid("Selecciona un proveedor válido."),
  status: z.enum(["draft", "ordered"], { error: "Estado inválido." }),
  items: z.array(purchaseItemSchema).min(1, "Agrega al menos un ítem."),
  note: z.string().trim().max(500, "Nota muy larga").optional().or(z.literal("")),
});

export const updatePurchaseSchema = purchaseSchema.omit({ status: true }).extend({
  id: z.uuid(),
});
