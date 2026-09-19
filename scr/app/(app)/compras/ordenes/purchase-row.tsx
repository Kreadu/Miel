"use client";

import { useActionState, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { markPurchaseOrdered } from "@/actions/purchases";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";
import Link from "next/link";

import { CancelPurchaseAction } from "./cancel-purchase-action";
import { ReceivePurchaseForm } from "./receive-purchase-form";

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  ordered: "Ordenada",
  received: "Recibida",
  cancelled: "Cancelada",
};

type PurchaseItem = {
  id: string;
  productName: string;
  productSku: string;
  qty: number;
  unitCost: number;
  taxRate: number;
};

export function PurchaseRow({
  purchase,
  canManage,
  warehouses,
}: {
  purchase: {
    id: string;
    supplierName: string;
    status: string;
    total: number;
    issuedAt: string | null;
    createdAt: string;
    items: PurchaseItem[];
  };
  canManage: boolean;
  warehouses: { id: string; name: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [markState, markAction] = useActionState(markPurchaseOrdered, null);

  return (
    <>
      <tr className="border-b border-border text-sm last:border-0">
        <td className="px-3 py-2.5">
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? "Ocultar ítems" : "Ver ítems"}
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-left hover:text-foreground"
          >
            {expanded ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
            {purchase.supplierName}
          </button>
        </td>
        <td className="px-3 py-2.5 text-muted-foreground">{STATUS_LABEL[purchase.status] ?? purchase.status}</td>
        <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(purchase.total)}</td>
        <td className="px-3 py-2.5 text-muted-foreground">
          {formatDate(purchase.issuedAt ?? purchase.createdAt)}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex flex-wrap items-end justify-end gap-1">
            {purchase.status === "draft" && canManage ? (
              <form action={markAction}>
                <input type="hidden" name="id" value={purchase.id} />
                <Button type="submit" variant="ghost" size="sm" className="h-7 text-xs">
                  Marcar como ordenada
                </Button>
              </form>
            ) : null}
            {purchase.status === "ordered" ? (
              <ReceivePurchaseForm purchaseId={purchase.id} warehouses={warehouses} />
            ) : null}
            {(purchase.status === "draft" || purchase.status === "ordered") && canManage ? (
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                <Link href={`/compras/ordenes?editar=${purchase.id}`}>Editar</Link>
              </Button>
            ) : null}
            {(purchase.status === "draft" || purchase.status === "ordered") && canManage ? (
              <CancelPurchaseAction purchaseId={purchase.id} />
            ) : null}
          </div>
          {markState && !markState.ok ? (
            <p role="alert" className="mt-1 text-right text-[10px] text-destructive">
              {markState.error}
            </p>
          ) : null}
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-border bg-muted/30 text-xs last:border-0">
          <td colSpan={5} className="px-3 py-2.5">
            {purchase.items.length > 0 ? (
              <table className="w-full text-left">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="py-1 font-medium">Producto</th>
                    <th className="py-1 text-right font-medium">Cantidad</th>
                    <th className="py-1 text-right font-medium">Costo unit.</th>
                    <th className="py-1 text-right font-medium">IVA %</th>
                    <th className="py-1 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {purchase.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-1">
                        {item.productSku} — {item.productName}
                      </td>
                      <td className="py-1 text-right tabular-nums">{item.qty}</td>
                      <td className="py-1 text-right tabular-nums">{formatMoney(item.unitCost)}</td>
                      <td className="py-1 text-right tabular-nums">{item.taxRate}</td>
                      <td className="py-1 text-right tabular-nums">
                        {formatMoney(item.qty * item.unitCost * (1 + item.taxRate / 100))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-muted-foreground">Sin ítems.</p>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}
