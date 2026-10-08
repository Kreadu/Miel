/** S26-02: número visible de la orden de compra (OC-0001). */
export function purchaseNumber(n: number): string {
  return `OC-${String(n).padStart(4, "0")}`;
}

/**
 * S26-02/S26-09: estado que ve el usuario. Un borrador sin aprobar es "Pendiente de aprobación";
 * uno ya aprobado (lo creó un aprobador) es un borrador más: "Aprobar y enviar" lo ordena.
 */
export function purchaseStatusKey(status: string, approvedAt: string | null): string {
  if (status !== "draft") return status;
  return approvedAt ? "draft" : "pending";
}
