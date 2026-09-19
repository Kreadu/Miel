import { z } from "zod";

export const supplierProductSchema = z.object({
  supplier_id: z.uuid("Proveedor inválido"),
  product_id: z.uuid("Producto inválido"),
});
