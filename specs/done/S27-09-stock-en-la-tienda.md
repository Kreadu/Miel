---
id: S27-09
titulo: La tienda web muestra el stock de cada producto
estado: implemented
depende_de: [S27-01, S27-08]
---

# S27-09 — Stock visible en la tienda web

## Decisión (pedido del humano, 2026-10-08)
- Cada producto de la tienda web, también los de tienda física (S27-08), muestra cuántas unidades
  hay: "Quedan N" o "Agotado". Es el stock total de la empresa, la suma de todas las bodegas, como
  ya usaba `available`.
- `store_catalog` devuelve `stock` (nunca negativo).

## Criterios
1. `store_catalog` devuelve el stock total por producto: 0 si no hay o si es negativo.
2. Cada tarjeta muestra "Quedan N" o "Agotado".

## Tests
- pgTAP: `supabase/tests/S27-09-stock-en-la-tienda.sql`.

## Historial
- 2026-10-08 · pedido y aprobado por el humano; implemented. Migración
  `20261008220000_stock-en-la-tienda.sql`. pgTAP solo en PGlite. Sin revisión visual.
