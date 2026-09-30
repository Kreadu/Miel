---
id: S21-06
titulo: La nómina entra a Finanzas según la clasificación del trabajador
estado: implemented
depende_de: [S21-04, S21-05, S7-02]
---

# S21-06 — Nómina en Finanzas

## Contexto y valor

Pedido del humano 2026-09-29 ("sigue"): usar "Su pago es" (gasto/costo, fijo/variable) para que
la nómina sume en Finanzas donde corresponde.

## Alcance

- Migración `20260929210552_nomina-en-finanzas.sql`: vista `monthly_payroll` (períodos cerrados,
  mes de fin de período, por clasificación; costo = devengado + aportes + provisiones; salida de
  caja = devengado + aportes; sin clasificar = gasto fijo). `monthly_pnl` gana
  `payroll_costs`/`payroll_expenses` (al final) y la utilidad los descuenta; `monthly_expenses`
  suma la nómina-gasto como categoría "Nómina"; `cash_flow` suma el pago de nómina a las salidas.
- Período de nómina: resumen "Costo para la empresa" por clasificación.

## Nota

- El módulo Finanzas sigue oculto en el menú (S14-01); los datos quedan listos para cuando se
  muestre. Pendiente de decisión del humano.

## Tests

- pgTAP `supabase/tests/S21-06-nomina-en-finanzas.sql`.
