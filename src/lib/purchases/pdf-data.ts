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
  items: {
    sku: string;
    name: string;
    qty: number;
    unitCost: number;
    taxRate: number;
    /** S26-11: bodega de entrega del ítem (null en órdenes viejas). */
    warehouse?: { name: string; address: string | null; city: string | null } | null;
  }[];
};

export type PurchaseDoc = ReturnType<typeof buildPurchaseDoc>;

function contactLines(c: Contact, city?: string | null): string[] {
  const place = [c.address, city].filter(Boolean).join(", ");
  return [c.nit ? `NIT ${c.nit}` : "", place, c.phone ?? "", c.email ?? ""].filter(Boolean);
}

/** S26-11: ítems agrupados por bodega de entrega (en orden de aparición). */
function groupByWarehouse<T extends PurchaseDocInput["items"][number]>(items: T[]) {
  const groups: { warehouse: string | null; address: string; items: T[] }[] = [];
  for (const it of items) {
    const name = it.warehouse?.name ?? null;
    let g = groups.find((x) => x.warehouse === name);
    if (!g) {
      g = { warehouse: name, address: [it.warehouse?.address, it.warehouse?.city].filter(Boolean).join(", "), items: [] };
      groups.push(g);
    }
    g.items.push(it);
  }
  return groups;
}

/** S26-03: datos ya armados del PDF de la orden (sin textos traducidos: esos los pone el render). */
export function buildPurchaseDoc(p: PurchaseDocInput) {
  const items = p.items.map((i) => ({ ...i, total: purchaseLine(i.qty, i.unitCost, i.taxRate).total }));
  return {
    number: purchaseNumber(p.number),
    draft: purchaseStatusKey(p.status, p.approvedAt) === "pending",
    date: p.issuedAt ?? p.createdAt,
    companyName: p.company.name,
    companyLines: contactLines(p.company, p.company.city),
    supplierName: p.supplier.name,
    supplierLines: contactLines(p.supplier),
    items,
    groups: groupByWarehouse(items),
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
