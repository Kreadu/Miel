/**
 * S23-01: redondeo a centavos único para todo el programa (mismo resultado que `round(x, 2)` de
 * Postgres). El épsilon evita el error de coma flotante (1.005 → 1.01, no 1.00).
 */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON * Math.sign(n)) * 100) / 100;
}
