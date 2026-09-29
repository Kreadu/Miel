---
id: S19-17
titulo: Stock total del producto, solo lectura, en listado y edición
estado: implemented
depende_de: [S19-13, S2-03]
---

# S19-17 — Stock total del producto (solo lectura)

## Contexto y valor

Pedido del humano 2026-09-29: ver el stock total del producto (suma de todas las bodegas o
sucursales) en el listado y al editar, sin poder cambiarlo ahí. Aprobación: pedido explícito;
spec + implementación en la misma sesión.

## Alcance

- Fuente: vista existente `current_stock` (S2-03) — sin esquema nuevo.
- Helper puro `totalStockByProduct(rows)` en `src/lib/stock.ts` (suma `total_qty` por producto).
- `/inventario/productos`: columna "Stock" en el listado; en el formulario de edición, línea de
  solo lectura "Stock total: N".
- `/ventas/catalogo`: el formulario de edición muestra la misma línea de solo lectura (las
  tarjetas ya mostraban el total desde S19-13).
- Supuesto (el humano no especificó pantalla): se aplica a ambos listados/ediciones de producto.

## NO-alcance

- No se edita stock desde estos campos (el stock sigue cambiando solo por movimientos).

## Criterios de aceptación

1. **Dado** un producto con movimientos en 2 bodegas **entonces** el listado de Inventario
   muestra la suma.
2. **Dado** la edición de ese producto (Inventario o Catálogo) **entonces** se ve "Stock total"
   sin input editable.
3. **Dado** un producto sin movimientos **entonces** muestra 0.

## Tests

- Vitest `src/lib/stock.test.ts`: suma por producto, ignora filas sin `product_id`, `null` → 0.
