"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { approvePurchase } from "@/actions/purchases";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";
import { purchaseNumber, purchaseStatusKey } from "@/lib/purchases/approval";
import Link from "next/link";

import { CancelPurchaseAction } from "./cancel-purchase-action";
import { PurchaseShare } from "./purchase-share";

type PurchaseItem = {
  id: string;
  productName: string;
  productSku: string;
  qty: number;
  warehouseName: string | null;
  receivedQty: number;
  unitCost: number;
  taxRate: number;
};

export function PurchaseRow({
  purchase,
  canManage,
  canApprove,
}: {
  purchase: {
    id: string;
    number: number;
    supplierName: string;
    supplierPhone: string | null;
    status: string;
    total: number;
    issuedAt: string | null;
    createdAt: string;
    requestedByName: string | null;
    requestedAt: string | null;
    approvedByName: string | null;
    approvedAt: string | null;
    items: PurchaseItem[];
  };
  canManage: boolean;
  canApprove: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approving, startApprove] = useTransition();
  const t = useTranslations();
  const statusKey = purchaseStatusKey(purchase.status, purchase.approvedAt);
  const error = approveError;

  return (
    <>
      <tr className="border-b border-border text-sm last:border-0">
        <td className="px-3 py-2.5">
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? t("purchases.hideItems") : t("purchases.showItems")}
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-left hover:text-foreground"
          >
            {expanded ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
            <span>
              <span className="block text-xs text-muted-foreground tabular-nums">{purchaseNumber(purchase.number)}</span>
              {purchase.supplierName}
            </span>
          </button>
        </td>
        <td className="px-3 py-2.5 text-muted-foreground">
          {t.has(`purchases.statuses.${statusKey}`) ? t(`purchases.statuses.${statusKey}`) : statusKey}
          {purchase.requestedByName && purchase.requestedAt ? (
            <span className="block text-xs">
              {t("purchases.requestedBy", { name: purchase.requestedByName, date: formatDate(purchase.requestedAt) })}
            </span>
          ) : null}
          {purchase.approvedByName && purchase.approvedAt ? (
            <span className="block text-xs">
              {t("purchases.approvedBy", { name: purchase.approvedByName, date: formatDate(purchase.approvedAt) })}
            </span>
          ) : null}
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(purchase.total)}</td>
        <td className="px-3 py-2.5 text-muted-foreground">
          {formatDate(purchase.issuedAt ?? purchase.createdAt)}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex flex-wrap items-end justify-end gap-1">
            {purchase.status === "draft" && canApprove ? (
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs"
                disabled={approving}
                onClick={() =>
                  startApprove(async () => {
                    const res = await approvePurchase(purchase.id);
                    setApproveError(res && !res.ok ? res.error : null);
                  })
                }
              >
                {approving ? "..." : t("purchases.approve")}
              </Button>
            ) : null}
            {canManage ? (
              <PurchaseShare
                purchaseId={purchase.id}
                number={purchaseNumber(purchase.number)}
                total={`$${formatMoney(purchase.total)}`}
                supplierPhone={purchase.supplierPhone}
              />
            ) : null}
            {purchase.status === "ordered" || purchase.status === "partially_received" ? (
              <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                <Link href={`/compras/ordenes/${purchase.id}/recibir`}>{t("purchases.receive")}</Link>
              </Button>
            ) : null}
            {/* S26-10: aprobada y enviada ya no se edita; antes, solo el dueño o un aprobador. */}
            {purchase.status === "draft" && canApprove ? (
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                <Link href={`/compras?editar=${purchase.id}`}>{t("purchases.edit")}</Link>
              </Button>
            ) : null}
            {(purchase.status === "draft" || purchase.status === "ordered") && canManage ? (
              <CancelPurchaseAction purchaseId={purchase.id} />
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="mt-1 text-right text-[10px] text-destructive">
              {t(error)}
              {error === "purchases.errors.displayNameRequired" ? (
                <>
                  {" "}
                  <Link href="/equipo/trabajadores" className="underline">
                    {t("purchases.goToProfile")}
                  </Link>
                </>
              ) : null}
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
                    <th className="py-1 font-medium">{t("purchases.product")}</th>
                    <th className="py-1 text-right font-medium">{t("purchases.qty")}</th>
                    <th className="py-1 text-right font-medium">{t("purchases.receipt.received")}</th>
                    <th className="py-1 text-right font-medium">{t("purchases.unitCost")}</th>
                    <th className="py-1 text-right font-medium">{t("purchases.taxPercent")}</th>
                    <th className="py-1 text-right font-medium">{t("purchases.subtotal")}</th>
                  </tr>
                </thead>
                <tbody>
                  {purchase.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-1">
                        {item.productSku} — {item.productName}
                        {item.warehouseName ? <span className="text-muted-foreground"> · {item.warehouseName}</span> : null}
                      </td>
                      <td className="py-1 text-right tabular-nums">{item.qty}</td>
                      <td className="py-1 text-right tabular-nums">{item.receivedQty}</td>
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
              <p className="text-muted-foreground">{t("purchases.noItems")}</p>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}
