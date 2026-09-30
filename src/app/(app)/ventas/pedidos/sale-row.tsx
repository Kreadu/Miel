import { formatDate, formatMoney } from "@/lib/format";

import { CancelSaleButton } from "./cancel-sale-button";
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
  cancelled: "Anulada",
};

// S19-08: descriptivo (cómo se espera pagar), no un cobro real — ver "Registrar cobro" para eso.
const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  other: "Otro",
};

export function SaleRow({
  sale,
  warehouses,
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
  };
  warehouses: { id: string; name: string }[];
  /** S23-01: owner/admin pueden anular. */
  canCancel: boolean;
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
        {sale.paymentMethod && (
          <div className="text-[10px] mt-0.5">
            Pago: {PAYMENT_METHOD_LABEL[sale.paymentMethod] ?? sale.paymentMethod}
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

          {canCancel && sale.status !== "cancelled" && <CancelSaleButton saleId={sale.id} />}
        </div>
      </td>
    </tr>
  );
}
