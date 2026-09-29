/**
 * S19-36: Pedidos muestra solo lo que falta terminar (boleta, despacho, entrega o cobro). Lo
 * entregado y pagado, y lo cancelado, queda en el historial de compras de cada cliente.
 */
export function isPendingSale(status: string, balance: number): boolean {
  if (status === "cancelled") return false;
  if (status === "delivered") return balance > 0;
  return true;
}
