import { purchaseNumber, purchaseStatusKey } from "./approval";
import { purchaseLine } from "./line";

type Contact = {
  name: string;
  nit: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
};

export type PurchaseDocInput = {
  number: number;
  status: string;
  createdAt: string;
  issuedAt: string | null;
  note: string | null;
  subtotal: number;
  tax: number;
  total: number;
  requestedByName: string | null;
  requestedAt: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  orderedByName: string | null;
  company: Contact & { city: string | null };
  supplier: Contact;
  items: { sku: string; name: string; qty: number; unitCost: number; taxRate: number }[];
};

export type PurchaseDoc = ReturnType<typeof buildPurchaseDoc>;

function contactLines(c: Contact, city?: string | null): string[] {
  const place = [c.address, city].filter(Boolean).join(", ");
  return [c.nit ? `NIT ${c.nit}` : "", place, c.phone ?? "", c.email ?? ""].filter(Boolean);
}

/** S26-03: datos ya armados del PDF de la orden (sin textos traducidos: esos los pone el render). */
export function buildPurchaseDoc(p: PurchaseDocInput) {
  return {
    number: purchaseNumber(p.number),
    draft: purchaseStatusKey(p.status, p.approvedAt) === "pending",
    date: p.issuedAt ?? p.createdAt,
    companyName: p.company.name,
    companyLines: contactLines(p.company, p.company.city),
    supplierName: p.supplier.name,
    supplierLines: contactLines(p.supplier),
    items: p.items.map((i) => ({ ...i, total: purchaseLine(i.qty, i.unitCost, i.taxRate).total })),
    subtotal: Number(p.subtotal),
    tax: Number(p.tax),
    total: Number(p.total),
    note: p.note,
    signatures: [
      { key: "requested", name: p.requestedByName, date: p.requestedAt },
      { key: "approved", name: p.approvedByName, date: p.approvedAt },
      { key: "ordered", name: p.orderedByName, date: p.issuedAt },
    ] as const,
  };
}
