---
id: S22-02
titulo: Estado de resultados con todos los márgenes
estado: implemented
depende_de: [S22-01, S21-06]
---

# S22-02 — Estado de resultados

## Contexto y valor

Pedido del humano 2026-09-30 (con la estructura exacta, que vale como aprobación): una página
debajo de RRHH en el menú con el estado de resultados de todo lo que genera el programa y todos los
márgenes: bruto, operativo/EBIT, EBITDA, antes de impuestos, neto y de contribución.

## Alcance

- Menú: "Resultados" (`/resultados`) debajo de RRHH, solo owner/admin.
- Migración: `expense_categories.pnl_line` (`operativo` | `depreciacion` | `financiero` |
  `impuesto_renta`, default `operativo`) y tres categorías nuevas sembradas: "Depreciación y
  amortización", "Intereses y gastos financieros", "Impuesto de renta" (fijas). "Cuotas de
  crédito o leasing" y "Comisiones bancarias y datáfono" pasan a `financiero`.
- Cálculo puro `src/lib/finance/income-statement.ts` por mes:
  - Ventas = `monthly_pnl.income`.
  - Costo de ventas = costo de lo vendido + nómina clasificada como costo.
  - Gastos operativos = gastos `operativo` + `depreciacion` + nómina clasificada como gasto.
  - Depreciación y amortización = gastos `depreciacion` (EBITDA = EBIT + D&A).
  - Gastos financieros = gastos `financiero`; Impuesto de renta = gastos `impuesto_renta`.
  - Margen de contribución = Ventas − (costo de lo vendido + nómina costo variable + todos los
    gastos variables, incluida la nómina gasto variable).
  - Márgenes = utilidad ÷ ventas; sin ventas se muestra "—".
- Pantalla: selector de mes (`?mes=AAAA-MM`, por defecto el actual), columna del mes y del mes
  anterior.

## Supuestos

- Categoría que no esté en `expense_categories` (gastos viejos escritos a mano) = operativa.
- Sin histórico de activos: la depreciación se anota como gasto con su categoría.

## NO-alcance

- Otros ingresos no operacionales; estado anual/acumulado; exportar.

## Tests

- Vitest `src/lib/finance/income-statement.test.ts`; pgTAP `supabase/tests/S22-02-lineas-de-resultados.sql`.
