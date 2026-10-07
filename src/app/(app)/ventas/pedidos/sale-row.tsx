import { getTranslations } from "next-intl/server";

import { formatDate, formatMoney } from "@/lib/format";

import { CancelSaleButton } from "./cancel-sale-button";
import type { AllocationItem, AllocationWarehouse, StockMap } from "./allocation-picker";
import { ConfirmSaleForm } from "./confirm-sale-form";
import { DeliverSaleAction } from "./deliver-sale-action";
import { PaymentForm } from "./payment-form";
import { ShipSaleForm } from "./ship-sale-form";

const RECEIVABLE_STATUSES = new Set(["confirmed", "shipped", "delivered"]);

export async function SaleRow({
  sale,
  warehouses,
  stock,
  defaultWarehouseId,
  canCancel,
}: {
  sale: {
    id: string;
    customerId: string | null;
    customerName: string | null;
    status: string;
    receiptNumber: number | null;
    total: number;
    balance: number;
    issuedAt: string | null;
    createdAt: string;
    shippingAddress: string | null;
    paymentMethod: string | null;
    /** S27-02: pedido que llegó de la tienda en línea. */
    store: { phone: string | null; payment: string | null; shippingToConfirm: boolean } | null;
    items: AllocationItem[];
  };
  warehouses: AllocationWarehouse[];
  stock: StockMap;
  defaultWarehouseId: string | null;
  /** S23-01: owner/admin pueden anular. */
  canCancel: boolean;
}) {
  const t = await getTranslations("sales");
  const isReceivable =
    RECEIVABLE_STATUSES.has(sale.status) && sale.customerId !== null && sale.balance > 0;

  return (
    <tr className="border-b border-border text-sm last:border-0">
      <td className="px-3 py-2.5">
        <div>{sale.customerName ?? t("orders.counter")}</div>
        {sale.store ? (
          <div className="mt-0.5 flex flex-col text-xs text-muted-foreground">
            <span className="w-fit rounded-sm bg-primary/10 px-1.5 py-0.5 font-medium text-foreground">{t("orders.fromStore")}</span>
            {sale.store.phone ? <a className="underline" href={`tel:${sale.store.phone}`}>{sale.store.phone}</a> : null}
            {sale.store.payment ? <span>{t("orders.prefersPayment", { method: t(`orders.storePayments.${sale.store.payment}`) })}</span> : null}
            {sale.store.shippingToConfirm ? <span>{t("orders.shippingToConfirm")}</span> : null}
          </div>
        ) : null}
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">
        <div>{t.has(`status.${sale.status}`) ? t(`status.${sale.status}`) : sale.status}</div>
        {sale.receiptNumber !== null && (
          <div className="text-[10px] mt-0.5 tabular-nums">{t("orders.receipt", { number: sale.receiptNumber })}</div>
        )}
        {sale.shippingAddress && (
          <div className="text-[10px] mt-0.5 truncate max-w-[150px]" title={sale.shippingAddress}>
            📍 {sale.shippingAddress}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(sale.total)}</td>
      <td className="px-3 py-2.5 text-muted-foreground">
        {formatDate(sale.issuedAt ?? sale.createdAt)}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-col gap-1 items-end">
          {sale.status === "draft" && (
            <ConfirmSaleForm
              saleId={sale.id}
              items={sale.items}
              warehouses={warehouses}
              stock={stock}
              defaultWarehouseId={defaultWarehouseId}
              canManage={canCancel}
            />
          )}
          
          {sale.status === "confirmed" && (
            <>
              <ShipSaleForm saleId={sale.id} />
              <DeliverSaleAction saleId={sale.id} isShipped={false} />
            </>
          )}

          {sale.status === "shipped" && (
            <DeliverSaleAction saleId={sale.id} isShipped={true} />
          )}

          {isReceivable && (
            <PaymentForm
              saleId={sale.id}
              customerId={sale.customerId!}
              balance={sale.balance}
              defaultMethod={sale.paymentMethod}
            />
          )}

          {/* S18-07: separada y abajo, para no confundirla con "Volver". */}
          {canCancel && sale.status !== "cancelled" && (
            <div className="mt-2 w-full border-t border-border pt-2">
              <CancelSaleButton saleId={sale.id} paid={sale.total - sale.balance} receiptNumber={sale.receiptNumber} />
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
