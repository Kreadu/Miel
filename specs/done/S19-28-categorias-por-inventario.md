---
id: S19-28
titulo: Categorías propias de cada inventario
estado: implemented
depende_de: [S19-26]
---

# S19-28 — Categorías por inventario

## Contexto y valor

Pedido del humano 2026-09-29: cada inventario tiene sus propias categorías y no se mezclan.
Aprobación: pedido explícito, misma sesión.

## Alcance

- Migración `20260929171419_categorias-por-inventario.sql`: `product_categories.inventory`
  (check con la lista de inventarios), nombre único por (empresa, inventario, nombre).
- Reparto de lo existente: cada categoría queda en el inventario de los ítems que la usan
  (productos si la usa algún producto o nadie); si la usaban ítems de otro inventario, se
  copia allá con el mismo nombre y esos ítems pasan a la copia.
- Trigger `check_product_category_inventory`: un ítem solo acepta categorías de su inventario
  (`category_inventory_mismatch`).
- `createCategory(name, inventory)`; `CategoryManager`/`CategoryPicker` reciben el inventario;
  `loadProducts` trae solo las categorías del inventario.

## Criterios de aceptación

1. Una categoría creada en un inventario no aparece en otro.
2. El mismo nombre puede existir en inventarios distintos, no repetido en el mismo.
3. Un ítem no puede quedar con una categoría de otro inventario.

## Tests

- pgTAP `supabase/tests/S19-28-categorias-por-inventario.sql`. Vitest `src/actions/catalog.test.ts`.
