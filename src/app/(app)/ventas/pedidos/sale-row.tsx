import { formatDate, formatMoney } from "@/lib/format";

import { ConfirmSaleForm } from "./confirm-sale-form";
import { DeliverSaleAction } from "./deliver-sale-action";
import { PaymentForm } from "./payment-form";
import { ShipSaleForm } from "./ship-sale-form";

const RECEIVABLE_STATUSES = new Set(["confirmed", "shipped", "delivered"]);

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  confirmed: "Confirmada",
  shipped: "Despachada",
  delivered: "Entregada",
  cancelled: "Cancelada",
};

export function SaleRow({
  sale,
  warehouses,
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
  };
  warehouses: { id: string; name: string }[];
}) {
  const isReceivable =
    RECEIVABLE_STATUSES.has(sale.status) && sale.customerId !== null && sale.balance > 0;

  return (
    <tr className="border-b border-border text-sm last:border-0">
      <td className="px-3 py-2.5">{sale.customerName ?? "Mostrador"}</td>
      <td className="px-3 py-2.5 text-muted-foreground">
        <div>{STATUS_LABEL[sale.status] ?? sale.status}</div>
        {sale.receiptNumber !== null && (
          <div className="text-[10px] mt-0.5 tabular-nums">Recibo #{sale.receiptNumber}</div>
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
          {sale.status === "draft" && <ConfirmSaleForm saleId={sale.id} warehouses={warehouses} />}
          
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
            <PaymentForm saleId={sale.id} customerId={sale.customerId!} balance={sale.balance} />
          )}
        </div>
      </td>
    </tr>
  );
}
