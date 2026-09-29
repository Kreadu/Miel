---
id: S19-23
titulo: Eliminar el Punto de Venta por completo
estado: implemented
depende_de: [S5-10, S19-22]
---

# S19-23 — Eliminar el Punto de Venta

## Contexto y valor

Pedido del humano 2026-09-29: "Punto de venta eliminalo todo". La venta en tienda queda como
Catálogo/Pedidos → boleta (confirm_sale, con caja abierta desde S19-22). Aprobación: pedido
explícito, misma sesión.

## Alcance

- Se borran `/ventas/pos` (página, terminal, alta rápida de cliente), `src/actions/pos.ts`,
  `src/lib/validation/pos.ts` (+ test), el acceso en Vender y el paso 5d del e2e.
- Migración `20260929154514_eliminar-pos.sql`: `drop function register_pos_sale`. Se borra
  `supabase/tests/S5-10-pos.sql` (probaba esa RPC). El arqueo de caja sigue cubierto por
  `S5-09-caja-arqueo.sql`.
- "Pedidos" pasa a ser la acción principal de Vender.

## Criterios de aceptación

1. Vender no muestra "Punto de Venta" y `/ventas/pos` da 404.
2. Caja, Pedidos y boleta siguen funcionando.
