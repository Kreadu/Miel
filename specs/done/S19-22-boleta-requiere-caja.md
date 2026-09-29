---
id: S19-22
titulo: La boleta de productos que se venden en tienda exige caja abierta
estado: implemented
depende_de: [S5-03, S5-09, S19-05]
---

# S19-22 — Boleta solo con caja abierta

## Contexto y valor

Pedido del humano 2026-09-29: los productos que se venden en tienda solo se venden con la caja
abierta; se puede generar el pedido, pero no la boleta. Decisiones confirmadas por el humano:
aplica a productos "Solo tienda" y "Ambas"; la caja que cuenta es la del usuario que confirma.

## Alcance

- `confirm_sale` (genera la boleta: `receipt_number`) — nuevo paso: si la venta tiene algún
  producto `sales_channel in ('in_store','both')` y quien confirma no tiene caja abierta en esa
  empresa → `cash_session_required`. Con caja, la venta queda ligada (`cash_session_id`).
- `create_sale` (pedido/borrador) sin cambios: no exige caja.
- POS ya exigía caja (S5-10); sin cambios.
- `confirmSale` traduce el error: "Abre tu caja para generar la boleta: el pedido tiene
  productos que se venden en tienda."
- `/ventas/pedidos` avisa cuando tu caja está cerrada, con enlace a `/ventas/caja`.
- Tests S5-03 y S5-08 ganan una caja abierta en sus fixtures (confirmaban sin caja).

## Criterios de aceptación

1. Con caja cerrada se crea el pedido.
2. Con caja cerrada no se genera boleta si hay productos "Solo tienda" o "Ambas".
3. Pedido solo con productos "Solo internet" genera boleta sin caja.
4. La caja abierta de otro usuario no alcanza.
5. Con caja propia abierta se genera la boleta y la venta queda ligada a la caja.

## Tests

- pgTAP `supabase/tests/S19-22-boleta-requiere-caja.sql` (C1–C5).
- Vitest `src/actions/sales.test.ts` (mensaje).
