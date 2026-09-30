import { z } from "zod";

export const stockMovementSchema = z
  .object({
    product_id: z.string().uuid("stock.errors.productInvalid"),
    warehouse_id: z.string().uuid("stock.errors.warehouseInvalid"),
    kind: z.enum(["in", "out", "adjust"], {
      error: "stock.errors.kindInvalid"
    }),
    qty: z.coerce.number().refine((val) => val !== 0, {
      message: "stock.errors.qtyZero",
    }),
    unit_cost: z.coerce.number().min(0, "products.errors.costNegative").default(0),
    note: z.string().max(255).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.kind !== "adjust" && data.qty < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "stock.errors.qtyPositive",
        path: ["qty"],
      });
    }
  });
