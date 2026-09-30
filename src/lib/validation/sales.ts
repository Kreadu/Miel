import { z } from "zod";

import { DELIVERY_METHODS } from "@/lib/shipping";

export const saleItemSchema = z.object({
  product_id: z.uuid("Selecciona un producto válido."),
  qty: z.coerce.number().positive("La cantidad debe ser mayor a cero."),
  // S23-01: precio, IVA y descuento no vienen del navegador — create_sale los toma del producto.
});

export const PAYMENT_METHODS = ["cash", "card", "transfer", "other"] as const;

export const saleSchema = z
  .object({
    customer_id: z.uuid("Selecciona un cliente válido.").optional().or(z.literal("")),
    items: z.array(saleItemSchema).min(1, "Agrega al menos un ítem."),
    note: z.string().trim().max(500, "Nota muy larga").optional().or(z.literal("")),
    // Descriptivo (S19-08): no registra un cobro real, solo anota cómo se espera pagar.
    payment_method: z.enum(PAYMENT_METHODS).optional().or(z.literal("")),
    // S19-35: forma de entrega. El costo lo calcula create_sale (salvo "acordado", a mano).
    delivery_method: z.enum(DELIVERY_METHODS).optional().or(z.literal("")),
    shipping_rate_id: z.uuid("Elige un transporte válido.").optional().or(z.literal("")),
    shipping_km: z.coerce.number().min(0, "Los km no pueden ser negativos.").optional(),
    shipping_cost: z.coerce.number().min(0, "El valor del envío no puede ser negativo.").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.delivery_method === "agreed" && data.shipping_cost === undefined) {
      ctx.addIssue({ code: "custom", message: "Escribe el valor del envío acordado.", path: ["shipping_cost"] });
    }
    if (data.delivery_method === "carrier") {
      if (!data.shipping_rate_id) {
        ctx.addIssue({ code: "custom", message: "Elige un transporte.", path: ["shipping_rate_id"] });
      }
      if (data.shipping_km === undefined) {
        ctx.addIssue({ code: "custom", message: "Escribe los km del envío.", path: ["shipping_km"] });
      }
    }
  });
