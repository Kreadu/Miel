/** S26-02: número visible de la orden de compra (OC-0001). */
export function purchaseNumber(n: number): string {
  return `OC-${String(n).padStart(4, "0")}`;
}

/**
 * S26-02: estado que ve el usuario. No hay status nuevos en la BD: un borrador sin aprobar es
 * "Pendiente de aprobación" y uno aprobado es "Aprobada"; el resto queda igual.
 */
export function purchaseStatusKey(status: string, approvedAt: string | null): string {
  if (status !== "draft") return status;
  return approvedAt ? "approved" : "pending";
}
