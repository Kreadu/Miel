"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { customerPaymentSchema } from "@/lib/validation/customer-payments";

export type CustomerPaymentState = { ok: false; error: string } | { ok: true } | null;

const SALES_PATH = "/ventas/pedidos";

function mapCustomerPaymentError(message: string | undefined): string {
  if (message?.includes("payment_exceeds_balance")) return "El monto supera el saldo pendiente de la venta.";
  if (message?.includes("sale_not_receivable")) return "Esta venta no está en un estado cobrable.";
  if (message?.includes("sale_customer_mismatch")) return "La venta no corresponde a este cliente.";
  if (message?.includes("customer_not_found")) return "Cliente inválido.";
  if (message?.includes("payment_amount_invalid")) return "El monto debe ser mayor a cero.";
  if (message?.includes("payment_method_invalid")) return "Selecciona un método de pago válido.";
  if (message?.includes("sale_not_found")) return "La venta indicada no existe.";
  return "No se pudo registrar el cobro. Intenta de nuevo.";
}

/** Cualquier miembro del tenant activo registra cobros (register_customer_payment lo valida igual: pertenencia, no rol admin). */
export async function registerCustomerPayment(
  _prev: CustomerPaymentState,
  formData: FormData,
): Promise<CustomerPaymentState> {
  const parsed = customerPaymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("register_customer_payment", {
    p_customer_id: parsed.data.customer_id,
    p_sale_id: (parsed.data.sale_id || null) as unknown as string,
    p_amount: parsed.data.amount,
    p_method: parsed.data.method,
    p_paid_at: parsed.data.paid_at || new Date().toISOString(),
    p_note: parsed.data.note || undefined,
  });

  if (error) {
    console.error("registerCustomerPayment:", error.code, error.message);
    return { ok: false, error: mapCustomerPaymentError(error.message) };
  }

  revalidatePath(SALES_PATH);
  return { ok: true };
}
