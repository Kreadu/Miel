-- S19-23 — Se elimina el Punto de Venta (pedido del humano 2026-09-29). La venta en tienda queda
-- como Catálogo/Pedidos → boleta (confirm_sale, con caja abierta desde S19-22).
-- Ver specs/done/S19-23-eliminar-punto-de-venta.md. Idempotente.
drop function if exists public.register_pos_sale(uuid, uuid, jsonb, jsonb, uuid, text);
