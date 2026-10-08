"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { formatMoney } from "@/lib/currency";
import { sendStoreOrderEmail } from "@/lib/email/store-order-email";
import { MAX_QTY } from "@/lib/store/cart";
import { DIAL_CODES, internationalPhone } from "@/lib/store/phone";
import { createClient } from "@/lib/supabase/server";

export type StoreOrderState =
  | { ok: true; code: string; total: number; token: string | null; receiver?: string }
  | { ok: false; error: string; product?: string }
  | null;

const E = "onlineStore.order.errors";
const PAYMENTS = ["nequi", "daviplata", "transfer", "cash_on_delivery", "in_store"] as const;

// S27-10: tipos de documento (los mismos de la ficha del cliente; pasaporte = "other").
const DOC_TYPES = ["cc", "ce", "nit", "other"] as const;
const docNumber = z.string().trim().regex(/^[0-9A-Za-z.-]{4,20}$/, `${E}.docInvalid`);
const localPhone = z
  .string()
  .trim()
  .refine((p) => p.replace(/\D/g, "").length >= 6 && p.replace(/\D/g, "").length <= 14, `${E}.phoneInvalid`);
const dial = z.string().refine((d) => DIAL_CODES.has(d), `${E}.phoneInvalid`);

const orderSchema = z
  .object({
    slug: z.string().max(40),
    first_name: z.string().trim().min(1, `${E}.nameRequired`).max(40, `${E}.nameRequired`),
    last_name: z.string().trim().min(1, `${E}.lastNameRequired`).max(40, `${E}.lastNameRequired`),
    doc_type: z.enum(DOC_TYPES, { error: `${E}.docInvalid` }),
    doc_number: docNumber,
    phone_country: dial,
    phone: localPhone,
    email: z.union([z.literal(""), z.email(`${E}.emailInvalid`).max(160)]),
    delivery: z.enum(["pickup", "delivery"], { error: `${E}.deliveryInvalid` }),
    payment: z.enum(PAYMENTS, { error: `${E}.paymentInvalid` }),
    address: z.string().trim().max(200),
    note: z.string().trim().max(500),
    // S27-10: casilla "Lo recibe/recoge quien compra"; si no, datos de quien recibe o recoge.
    buyer_receives: z.boolean(),
    receiver: z
      .object({
        name: z.string().trim().min(2, `${E}.receiverInvalid`).max(80, `${E}.receiverInvalid`),
        doc_type: z.enum(DOC_TYPES, { error: `${E}.receiverInvalid` }),
        doc_number: z.string().trim().regex(/^[0-9A-Za-z.-]{4,20}$/, `${E}.receiverInvalid`),
        phone_country: z.string().refine((d) => DIAL_CODES.has(d), `${E}.receiverInvalid`),
        phone: z
          .string()
          .trim()
          .refine((p) => p.replace(/\D/g, "").length >= 6 && p.replace(/\D/g, "").length <= 14, `${E}.receiverInvalid`),
      })
      .nullable(),
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

  const buyerReceives = get("buyer_receives") === "1";
  const parsed = orderSchema.safeParse({
    slug: get("slug"),
    first_name: get("first_name"),
    last_name: get("last_name"),
    doc_type: get("doc_type"),
    doc_number: get("doc_number"),
    phone_country: get("phone_country"),
    phone: get("phone"),
    buyer_receives: buyerReceives,
    receiver: buyerReceives
      ? null
      : {
          name: get("receiver_name"),
          doc_type: get("receiver_doc_type"),
          doc_number: get("receiver_doc_number"),
          phone_country: get("receiver_phone_country"),
          phone: get("receiver_phone"),
        },
    email: get("email").trim(),
    delivery: get("delivery"),
    payment: get("payment"),
    address: get("address"),
    note: get("note"),
    items: Array.isArray(items) ? items.map((i) => ({ product_id: i?.product_id, qty: i?.qty })) : items,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const o = parsed.data;
  const receiver = o.receiver
    ? {
        name: o.receiver.name,
        doc_type: o.receiver.doc_type,
        doc_number: o.receiver.doc_number,
        phone: internationalPhone(o.receiver.phone_country, o.receiver.phone),
      }
    : null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_store_order", {
    p_slug: o.slug,
    p_customer: {
      name: `${o.first_name} ${o.last_name}`,
      phone: internationalPhone(o.phone_country, o.phone),
      email: o.email || null,
      doc_type: o.doc_type,
      doc_number: o.doc_number,
      ...(receiver ? { receiver } : {}),
    },
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
    if (message.includes("receiver_invalid")) return { ok: false, error: `${E}.receiverInvalid` };
    if (message.includes("customer_invalid")) return { ok: false, error: `${E}.docInvalid` };
    console.error("placeStoreOrder:", message);
    return { ok: false, error: `${E}.failed` };
  }
  const order = { code: data[0].order_code, total: Number(data[0].total), token: data[0].token };

  // S27-04 (H5): correo a la empresa solo si Miel tiene correo configurado (hoy no: sin servidor).
  if (process.env.RESEND_API_KEY) {
    const { data: info } = await supabase.rpc("store_info", { p_slug: o.slug });
    const store = info?.[0];
    if (store?.email) {
      await sendStoreOrderEmail({
        to: store.email,
        storeName: store.name,
        code: order.code,
        total: formatMoney(order.total, store.currency),
        ordersUrl: `${(await headers()).get("origin") ?? ""}/ventas/pedidos`,
      });
    }
  }

  // Para el WhatsApp a la tienda: quién recibe o recoge (si no es el comprador).
  return { ok: true, ...order, ...(receiver ? { receiver: `${receiver.name} · ${receiver.phone}` } : {}) };
}
