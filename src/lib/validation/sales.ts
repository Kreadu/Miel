import { z } from "zod";

import { DELIVERY_METHODS } from "@/lib/shipping";

export const saleItemSchema = z.object({
  product_id: z.uuid("sales.errors.productInvalid"),
  qty: z.coerce.number().positive("sales.errors.qtyPositive"),
  // S23-01: precio, IVA y descuento no vienen del navegador — create_sale los toma del producto.
});

export const PAYMENT_METHODS = ["cash", "card", "transfer", "other"] as const;

export const saleSchema = z
  .object({
    customer_id: z.uuid("sales.errors.customerInvalid").optional().or(z.literal("")),
    items: z.array(saleItemSchema).min(1, "sales.errors.itemsRequired"),
    note: z.string().trim().max(500, "common.errors.noteTooLong").optional().or(z.literal("")),
    // Descriptivo (S19-08): no registra un cobro real, solo anota cómo se espera pagar.
    payment_method: z.enum(PAYMENT_METHODS).optional().or(z.literal("")),
    // S19-35: forma de entrega. El costo lo calcula create_sale (salvo "acordado", a mano).
    delivery_method: z.enum(DELIVERY_METHODS).optional().or(z.literal("")),
    shipping_rate_id: z.uuid("sales.errors.shippingRateInvalid").optional().or(z.literal("")),
    shipping_km: z.coerce.number().min(0, "sales.errors.kmNegative").optional(),
    shipping_cost: z.coerce.number().min(0, "sales.errors.shippingCostInvalid").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.delivery_method === "agreed" && data.shipping_cost === undefined) {
      ctx.addIssue({ code: "custom", message: "sales.errors.agreedCostRequired", path: ["shipping_cost"] });
    }
    if (data.delivery_method === "carrier") {
      if (!data.shipping_rate_id) {
        ctx.addIssue({ code: "custom", message: "sales.errors.shippingRateRequired", path: ["shipping_rate_id"] });
      }
      if (data.shipping_km === undefined) {
        ctx.addIssue({ code: "custom", message: "sales.errors.kmRequired", path: ["shipping_km"] });
      }
    }
  });

export const DOCUMENT_TYPES = ["boleta", "factura"] as const;

/** S18-10: de qué bodega sale cada parte de un producto (la de la venta + las que prestan stock). */
export const allocationsSchema = z
  .array(
    z.object({
      product_id: z.uuid("sales.errors.allocationMismatch"),
      warehouse_id: z.uuid("sales.errors.warehouseInvalid"),
      qty: z.coerce.number().positive("sales.errors.allocationMismatch"),
    }),
  )
  .min(1, "sales.errors.allocationMismatch");

/** S18-06: venta de mostrador en un paso — exige forma de pago y bodega; cobra el total. */
export const checkoutSchema = z.object({
  customer_id: z.uuid("sales.errors.customerInvalid").optional().or(z.literal("")),
  items: z.array(saleItemSchema).min(1, "sales.errors.itemsRequired"),
  note: z.string().trim().max(500, "common.errors.noteTooLong").optional().or(z.literal("")),
  payment_method: z.enum(PAYMENT_METHODS, { error: "sales.errors.paymentMethodRequired" }),
  warehouse_id: z.uuid("sales.errors.warehouseInvalid"),
  document_type: z.enum(DOCUMENT_TYPES, { error: "sales.errors.documentTypeInvalid" }).default("boleta"),
  allocations: allocationsSchema.optional(),
});
