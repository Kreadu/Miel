---
id: S19-27
titulo: Alertas stock mínimo con foto, de todos los inventarios, y "Agregar a orden de compra"
estado: implemented
depende_de: [S19-26, S3-02]
---

# S19-27 — Alertas stock mínimo → orden de compra

## Contexto y valor

Pedido del humano 2026-09-29: Alertas stock mínimo muestra todo lo que llegó a su mínimo en
cualquier inventario, con imagen y un botón para agregar a orden de compra; se juntan ítems y
el proveedor se elige al final (recomendación aceptada). Aprobación: pedido explícito.

## Alcance

- `/inventario/alertas`: tarjetas con foto, inventario, stock actual vs mínimo; "Agregar a orden
  de compra" (toggle), "Agregar todos", "Crear orden de compra (n)" → `/compras/ordenes?desde=<ids>`.
- `/compras/ordenes`: con `?desde=` el formulario de alta arranca con esos ítems (costo e IVA
  del producto, cantidad sugerida = doble del mínimo − stock actual, mínimo 1). Proveedor y
  cantidades se editan antes de crear. Sin esquema nuevo; sigue usando `create_purchase`.
- Helpers `src/lib/purchases/reorder.ts` (`suggestedReorderQty`, `parseProductIds`).

## Criterios de aceptación

1. Aparecen ítems de cualquier inventario bajo su mínimo, con foto.
2. Los elegidos llegan cargados a la orden de compra; solo falta el proveedor.

## Tests

- Vitest `src/lib/purchases/reorder.test.ts`.
