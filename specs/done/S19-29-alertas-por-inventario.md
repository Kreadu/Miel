---
id: S19-29
titulo: Alertas stock mínimo con un botón por inventario
estado: implemented
depende_de: [S19-27]
---

# S19-29 — Alertas por inventario

## Contexto y valor

Pedido del humano 2026-09-29: todo ítem de cualquier inventario bajo su stock mínimo genera
alerta; dentro de Alertas, un botón por inventario y, al entrar, sus ítems bajo el mínimo para
crear desde ahí la orden de compra. Aprobación: pedido explícito, misma sesión.

## Alcance

- `/inventario/alertas`: botones de los 7 inventarios con la cantidad en alerta de cada uno
  (`?inventario=<slug>`); al elegir uno, sus tarjetas con foto y el flujo de S19-27 (agregar a
  orden de compra → crear orden). Sin inventario elegido, se pide elegir uno.
- La alerta sale de la vista existente `low_stock_alerts` (todo ítem activo con `min_stock > 0`
  y stock ≤ mínimo), que ya cubre todos los inventarios. Sin esquema nuevo.

## Criterios de aceptación

1. Cada inventario muestra cuántos ítems están bajo el mínimo.
2. Dentro de un inventario, solo sus ítems, y desde ahí se arma la orden de compra.
