/** S27-03: formas de pago que la empresa configuró para su tienda (viene de store_info.payments). */
export const STORE_PAYMENTS = ["nequi", "daviplata", "transfer", "cash_on_delivery", "in_store"] as const;
export type StorePaymentMethod = (typeof STORE_PAYMENTS)[number];

export type StorePayments = {
  nequi: string | null;
  daviplata: string | null;
  transfer: string | null;
  qr: string | null;
  cash_on_delivery: boolean;
  in_store: boolean;
};

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
const flag = (v: unknown) => (typeof v === "boolean" ? v : true);

export function parseStorePayments(raw: unknown): StorePayments {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    nequi: text(r.nequi),
    daviplata: text(r.daviplata),
    transfer: text(r.transfer),
    qr: text(r.qr),
    cash_on_delivery: flag(r.cash_on_delivery),
    in_store: flag(r.in_store),
  };
}

/** Mismas reglas que place_store_order: con datos o encendidos; "al recoger" solo si recoge. */
export function offeredPayments(p: StorePayments, delivery: "pickup" | "delivery"): StorePaymentMethod[] {
  return STORE_PAYMENTS.filter((m) => {
    if (m === "in_store") return p.in_store && delivery === "pickup";
    if (m === "cash_on_delivery") return p.cash_on_delivery;
    return p[m] !== null;
  });
}

export type PaymentInstruction = { kind: "wallet" | "bank"; value: string } | { kind: "offline" };

export function paymentInstructions(method: StorePaymentMethod, p: StorePayments): PaymentInstruction {
  if ((method === "nequi" || method === "daviplata") && p[method]) return { kind: "wallet", value: p[method] };
  if (method === "transfer" && p.transfer) return { kind: "bank", value: p.transfer };
  return { kind: "offline" };
}
