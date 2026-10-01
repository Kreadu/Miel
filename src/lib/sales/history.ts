/** S18-11: totales del historial de pedidos (las anuladas no cuentan). */
export function salesHistoryTotals(rows: { status: string; total: number; paid: number }[]) {
  return rows
    .filter((r) => r.status !== "cancelled")
    .reduce((acc, r) => ({ sold: acc.sold + r.total, collected: acc.collected + r.paid }), { sold: 0, collected: 0 });
}
