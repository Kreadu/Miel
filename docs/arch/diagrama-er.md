---
topic: diagrama-er
status: vigente
related: [../data-model.md, multitenancy-rls.md]
---

# Diagrama ER del MVP

Mapa visual de la estructura de información. El detalle fino (tipos, checks, invariantes)
vive en `data-model.md` — ante discrepancia, manda data-model.md y se corrige aquí.
Omitido por legibilidad: `tenant_id` (toda tabla lo lleva, FK a tenants), `created_by`
(toda tabla de negocio, FK a auth.users), `created_at`, y las vistas (derivadas).

```mermaid
erDiagram
  %% ── Multitenancy ──
  tenants ||--o{ memberships : "tiene"
  tenants ||--o{ invitations : "emite"

  %% ── Inventario ──
  warehouses ||--o{ stock_movements : "registra"
  products ||--o{ stock_movements : "se mueve"

  %% ── Compras ──
  suppliers ||--o{ purchases : "recibe orden"
  purchases ||--|{ purchase_items : "contiene"
  products ||--o{ purchase_items : "se compra"
  suppliers ||--o{ supplier_payments : "cobra"
  purchases |o--o{ supplier_payments : "abona a"

  %% ── Ventas, POS y CRM ──
  customers |o--o{ sales : "compra"
  sales ||--|{ sale_items : "contiene"
  products ||--o{ sale_items : "se vende"
  customers ||--o{ customer_payments : "paga"
  sales |o--o{ customer_payments : "abona a"
  customers ||--o{ customer_interactions : "registra"
  cash_sessions |o--o{ sales : "agrupa"
  cash_sessions |o--o{ customer_payments : "arquea"

  %% ── Producción ──
  products ||--o{ recipe_items : "receta de"
  products ||--o{ recipe_items : "componente en"
  products ||--o{ productions : "produce"
  warehouses ||--o{ productions : "en bodega"
  productions ||--|{ production_items : "consume"
  products ||--o{ production_items : "insumo"

  %% ── Gastos ──
  suppliers |o--o{ expenses : "origina"

  %% ── Documentos → Kardex ──
  purchases ||..o{ stock_movements : "ref entrada"
  sales ||..o{ stock_movements : "ref salida"
  productions ||..o{ stock_movements : "ref prod in/out"
```

Notas de lectura:
- `stock_movements` es el Kardex: todo documento que afecta stock (compra recibida, venta
  confirmada/POS, producción) genera ahí sus filas vía RPC — las líneas punteadas son la
  referencia polimórfica `ref_type/ref_id`.
- `sales.customer_id` es nullable (venta de mostrador) igual que `sales.cash_session_id`
  (venta back-office sin caja): por eso `|o--o{`.
- Vistas derivadas (no en el diagrama): current_stock, kardex, supplier_balances,
  customer_balances, customer_history, cash_session_summary, monthly_pnl, monthly_expenses,
  cash_flow, product_profitability.
