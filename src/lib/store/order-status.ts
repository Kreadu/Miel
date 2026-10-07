import { parseStorePayments, type StorePaymentMethod, type StorePayments } from "./payments";

/** S27-04: pedido de la tienda tal como lo ve el cliente (store_order_status, sin datos personales). */
export type StoreOrder = {
  code: string;
  createdAt: string;
  status: string;
  subtotal: number;
  tax: number;
  shippingCost: number;
  total: number;
  delivery: "pickup" | "delivery";
  payment: StorePaymentMethod | null;
  paymentStatus: "pending" | "proof_sent" | "paid";
  canUpload: boolean;
  items: { name: string; qty: number; lineTotal: number }[];
  payments: StorePayments;
};

export function parseOrderStatus(raw: unknown): StoreOrder | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.code !== "string" || typeof r.status !== "string") return null;
  const items = Array.isArray(r.items) ? (r.items as Record<string, unknown>[]) : [];
  return {
    code: r.code,
    createdAt: String(r.created_at ?? ""),
    status: r.status,
    subtotal: Number(r.subtotal ?? 0),
    tax: Number(r.tax ?? 0),
    shippingCost: Number(r.shipping_cost ?? 0),
    total: Number(r.total ?? 0),
    delivery: r.delivery === "pickup" ? "pickup" : "delivery",
    payment: (typeof r.payment === "string" ? r.payment : null) as StorePaymentMethod | null,
    paymentStatus: r.payment_status === "paid" || r.payment_status === "proof_sent" ? r.payment_status : "pending",
    canUpload: r.can_upload === true,
    items: items.map((i) => ({ name: String(i.name ?? ""), qty: Number(i.qty ?? 0), lineTotal: Number(i.line_total ?? 0) })),
    payments: parseStorePayments(r.payments),
  };
}

const STEPS = ["received", "confirmed", "shipped", "delivered"] as const;
const REACHED: Record<string, number> = { draft: 0, confirmed: 1, shipped: 2, delivered: 3 };

/** Recibido → Confirmado → Enviado → Entregado (o Recibido → Cancelado). */
export function orderTimeline(status: string): { step: string; done: boolean }[] {
  if (status === "cancelled") return [{ step: "received", done: true }, { step: "cancelled", done: true }];
  const reached = REACHED[status] ?? 0;
  return STEPS.map((step, i) => ({ step, done: i <= reached }));
}
