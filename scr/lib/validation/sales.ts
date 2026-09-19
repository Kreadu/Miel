import { z } from "zod";

export const saleItemSchema = z.object({
  product_id: z.uuid("Selecciona un producto válido."),
  qty: z.coerce.number().positive("La cantidad debe ser mayor a cero."),
  unit_price: z.coerce.number().min(0, "El precio no puede ser negativo."),
  tax_rate: z.coerce.number().min(0).max(100, "El IVA debe estar entre 0 y 100.").default(0),
  // Monto de descuento por línea (precio de lista intacto, S5-08). La UI captura % y lo
  // convierte a monto antes de enviar; la RPC revalida que no supere el valor de la línea.
  discount: z.coerce.number().min(0, "El descuento no puede ser negativo.").default(0),
});

export const saleSchema = z.object({
  customer_id: z.uuid("Selecciona un cliente válido.").optional().or(z.literal("")),
  items: z.array(saleItemSchema).min(1, "Agrega al menos un ítem."),
  note: z.string().trim().max(500, "Nota muy larga").optional().or(z.literal("")),
});
