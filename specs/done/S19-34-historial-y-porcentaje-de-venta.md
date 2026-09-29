---
id: S19-34
titulo: Historial por inventario y bodega con rango de fechas + % de venta sobre el costo
estado: implemented
depende_de: [S19-26, S19-32]
---

# S19-34 — Historial por inventario + % de venta

## Contexto y valor

Pedido del humano 2026-09-29: la tabla de stock de la pantalla de Inventario va adentro de
cada inventario y por bodega, visible solo al apretar "Historial" y con intervalo de fechas;
columnas bodega, código, producto, stock, coste, % de venta, valor venta. En el formulario del
producto, un % de venta sobre el costo cuyo resultado es el precio de venta; todo ordenado.
Aprobación: pedido explícito, misma sesión.

## Alcance

- Función `inventory_history(inventory, from, to, warehouse?)` (migración
  `20260929181537_historial-de-inventario.sql`, security invoker, fechas en hora de Bogotá):
  ítems del inventario con movimiento en el rango, stock al final del rango, costo (enmascarado
  a member vía `products_catalog`) y precio.
- `/inventario`: se quita la tabla de stock. Cada inventario: botón "Historial" → desde/hasta
  (por defecto 1 del mes → hoy) + bodega (o todas) → tabla con Bodega, Código, Producto (link
  al kardex), Stock, Coste, % de venta, Valor venta (stock × precio) y total. Formulario GET,
  sin JS de cliente para el filtro.
- Formulario del producto: Costo · % de venta · Precio de venta en una fila (`PriceFields`):
  el precio se calcula del costo + %; si se escribe el precio, el % se recalcula. Solo se
  guardan costo y precio (el % se deriva, sin columna nueva). Campos reordenados en pares.

## Supuesto

- "Historial con intervalo de fechas" = ítems con movimiento en el rango, con su stock al
  final del rango.

## Tests

- pgTAP `supabase/tests/S19-34-historial-inventario.sql`. Vitest `src/lib/pricing.test.ts`,
  `src/lib/inventory-history.test.ts`.
