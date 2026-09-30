---
id: S19-37
titulo: Comprar como hoja de compra (proveedor con +, líneas con foto y costos con IVA, historial)
estado: implemented
depende_de: [S3-02, S19-27, S19-34]
---

# S19-37 — Hoja de compra

## Contexto y valor

Pedido del humano 2026-09-29: las órdenes de compra se generan desde Alertas (el botón lleva a
Comprar) y también al entrar a Comprar; proveedor con "+" para crearlo; cada línea con foto,
código, cantidad, costo antes de IVA (precio del proveedor), IVA, costo unitario con IVA y
costo total, más el costo total de la compra. El costo unitario con IVA es el costo del
producto, sobre el que se aplica el % de venta. El historial de compras se abre con un botón
"Historial", con rango de fechas y proveedor. Aprobación: pedido explícito, misma sesión.

## Alcance

- Migración `20260929190630_costo-con-iva-al-recibir.sql`: `receive_purchase` registra el ingreso al kardex con el costo unitario
  con IVA y actualiza `products.cost` a ese valor (promedio ponderado si el producto se repite
  en la orden). El precio de venta no cambia: el % de venta del producto se recalcula solo.
- `/compras` es la hoja de compra: formulario de orden, "Órdenes por recibir" (borrador y
  ordenada, con sus acciones) y "Historial" (GET: desde/hasta/proveedor, total comprado).
  `/compras/ordenes` redirige a `/compras` conservando la query. Alertas →
  `/compras?reponer=<ids>`.
- `SupplierPicker` + `quickCreateSupplier` (modal sin `<form>`).
- Líneas: foto, producto (código — nombre), cantidad, costo antes de IVA, IVA %, costo unit.
  con IVA y costo total (`purchaseLine`); al elegir un producto se sugiere su costo antes de
  IVA (`costBeforeTax`).

## Tests

- pgTAP `supabase/tests/S19-37-costo-con-iva.sql`. Vitest `src/lib/purchases/line.test.ts`,
  `src/actions/suppliers.test.ts`, `src/actions/purchases.test.ts`.
