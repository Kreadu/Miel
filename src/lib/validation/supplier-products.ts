import { z } from "zod";

export const supplierProductSchema = z.object({
  supplier_id: z.uuid("purchases.errors.supplierInvalid"),
  product_id: z.uuid("suppliers.errors.productInvalid"),
});
