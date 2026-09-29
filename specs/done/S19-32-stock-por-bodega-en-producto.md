---
id: S19-32
titulo: Stock por bodega o sucursal y stock mínimo en el producto (editable en Inventario, solo lectura en Vender)
estado: implemented
depende_de: [S19-24, S19-26]
---

# S19-32 — Stock por bodega en el producto

## Contexto y valor

Pedido del humano 2026-09-29: el producto debe mostrar el stock de cada bodega o sucursal; en
Vender solo se muestra; el stock mínimo solo se edita en el producto de Inventario. Decisión
del humano: en Inventario el stock de cada bodega es editable (Recomendado). Luego: los campos
de stock deben quedar al mismo nivel. Supersede la parte de "stock solo lectura" de S19-20
para el lado Inventario. Aprobación: pedido explícito + respuesta, misma sesión.

## Alcance

- RPC `set_product_stock(product_id, levels jsonb)` (migración
  `20260929173340_stock-por-bodega-editable.sql`): owner/admin; fija la cantidad objetivo por
  bodega registrando la diferencia como `adjust` vía `register_movement` (kardex), atómica;
  invariantes `stock_negative`, `warehouse_invalid`, `permission_denied`.
- Formulario (`ProductFields`, `mode`): recuadro "Stock por bodega o sucursal" con stock mínimo
  + un campo por bodega activa (+ archivadas con stock, solo lectura) en una grilla alineada.
  `inventory`: inputs editables (`stock__<id>`, `min_stock`); `sales` (Catálogo): cajas de
  solo lectura del mismo tamaño.
- Acciones: `stockLevelsSchema`; alta y edición llaman `set_product_stock` si vienen campos
  de stock; `min_stock` opcional (si no viene, no se toca).

## Criterios de aceptación

1. En Inventario: ver y cambiar el stock de cada bodega y el stock mínimo; el cambio queda en
   el kardex como ajuste.
2. En Vender: se ven igual, sin poder editar.
3. Stock negativo rechazado; todo o nada.

## Tests

- pgTAP `supabase/tests/S19-32-stock-por-bodega.sql`. Vitest `src/actions/products.test.ts`,
  `src/lib/stock.test.ts`.
