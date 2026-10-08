import { z } from "zod";

export const purchaseItemSchema = z.object({
  product_id: z.uuid("stock.errors.productInvalid"),
  // S26-11: bodega de destino del ítem (las órdenes viejas no la tienen).
  warehouse_id: z.uuid("purchases.errors.warehouseInvalid").nullable().optional(),
  qty: z.coerce.number().positive("sales.errors.qtyPositive"),
  unit_cost: z.coerce.number().min(0, "products.errors.costNegative"),
  tax_rate: z.coerce.number().min(0, "products.errors.taxRange").max(100, "products.errors.taxRange").default(0),
});

export const purchaseSchema = z.object({
  supplier_id: z.uuid("purchases.errors.supplierInvalid"),
  status: z.enum(["draft", "ordered"], { error: "purchases.errors.statusInvalid" }),
  items: z.array(purchaseItemSchema).min(1, "purchases.errors.itemsRequired"),
  note: z.string().trim().max(500, "common.errors.noteTooLong").optional().or(z.literal("")),
});

export const updatePurchaseSchema = purchaseSchema.omit({ status: true }).extend({
  id: z.uuid(),
});
