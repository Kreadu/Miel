"use server";

import { z } from "zod";

import { MAX_QTY } from "@/lib/store/cart";
import { createClient } from "@/lib/supabase/server";

export type StoreOrderState =
  | { ok: true; code: string; total: number; token: string | null }
  | { ok: false; error: string; product?: string }
  | null;

const E = "onlineStore.order.errors";
const PAYMENTS = ["nequi", "daviplata", "transfer", "cash_on_delivery", "in_store"] as const;

const orderSchema = z
  .object({
    slug: z.string().max(40),
    name: z.string().trim().min(2, `${E}.nameRequired`).max(80, `${E}.nameRequired`),
    phone: z
      .string()
      .trim()
      .refine((p) => p.replace(/\D/g, "").length >= 7 && p.replace(/\D/g, "").length <= 15, `${E}.phoneInvalid`),
    email: z.union([z.literal(""), z.email(`${E}.emailInvalid`).max(160)]),
    delivery: z.enum(["pickup", "delivery"], { error: `${E}.deliveryInvalid` }),
    payment: z.enum(PAYMENTS, { error: `${E}.paymentInvalid` }),
    address: z.string().trim().max(200),
    note: z.string().trim().max(500),
    items: z
      .array(
        z.object({
          product_id: z.guid(`${E}.cartEmpty`),
          qty: z.number().int(`${E}.qtyInvalid`).min(1, `${E}.qtyInvalid`).max(MAX_QTY, `${E}.qtyInvalid`),
        }),
      )
      .min(1, `${E}.cartEmpty`)
      .max(30, `${E}.cartEmpty`),
  })
  .refine((o) => o.delivery !== "delivery" || o.address !== "", { message: `${E}.addressRequired` })
  .refine((o) => o.payment !== "in_store" || o.delivery === "pickup", { message: `${E}.paymentInvalid` });

/**
 * S27-02: pedido del visitante de la tienda (sin cuenta). Solo viajan id y cantidad: precios,
 * stock y límites los decide place_store_order en la BD (ADR-044).
 */
export async function placeStoreOrder(_prev: StoreOrderState, formData: FormData): Promise<StoreOrderState> {
  const get = (k: string) => formData.get(k)?.toString() ?? "";
  // Campo trampa: un humano no lo ve; un bot lo llena. Se responde igual, sin crear nada.
  if (get("website") !== "") return { ok: true, code: "--------", total: 0, token: null };

  let items: unknown;
  try {
    items = JSON.parse(get("items"));
  } catch {
    return { ok: false, error: `${E}.cartEmpty` };
  }

  const parsed = orderSchema.safeParse({
    slug: get("slug"),
    name: get("name"),
    phone: get("phone"),
    email: get("email").trim(),
    delivery: get("delivery"),
    payment: get("payment"),
    address: get("address"),
    note: get("note"),
    items: Array.isArray(items) ? items.map((i) => ({ product_id: i?.product_id, qty: i?.qty })) : items,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const o = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_store_order", {
    p_slug: o.slug,
    p_customer: { name: o.name, phone: o.phone, email: o.email || null },
    p_items: o.items,
    p_delivery: o.delivery,
    p_payment: o.payment,
    p_address: o.delivery === "delivery" ? o.address : undefined,
    p_note: o.note || undefined,
  });

  if (error || !data?.[0]) {
    const message = error?.message ?? "";
    if (message.startsWith("product_unavailable:")) {
      return { ok: false, error: `${E}.productUnavailable`, product: message.slice("product_unavailable:".length) };
    }
    if (message.includes("too_many_orders")) return { ok: false, error: `${E}.tooMany` };
    if (message.includes("store_unavailable")) return { ok: false, error: `${E}.storeUnavailable` };
    console.error("placeStoreOrder:", message);
    return { ok: false, error: `${E}.failed` };
  }
  return { ok: true, code: data[0].order_code, total: Number(data[0].total), token: data[0].token };
}
