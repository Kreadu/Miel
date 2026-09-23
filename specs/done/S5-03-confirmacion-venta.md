---
id: S5-03
titulo: Confirmación de venta
estado: implemented
depende_de: [S5-02, S2-03]
---

# S5-03 — Confirmación de venta

## Contexto y valor
Una vez que el vendedor o cajero registra la venta (S5-02), esta debe ser confirmada. La confirmación es el momento en que se genera la salida real del inventario y se congela el costo unitario de los productos vendidos, garantizando que el margen histórico (COGS) no cambie si el costo promedio del producto fluctúa en el futuro. Es análoga a la recepción de compras (S3-03).

## Alcance
- RPC `confirm_sale(p_sale_id, p_warehouse_id)`: transiciona el estado de la venta de `draft` a `confirmed`.
- Itera sobre los `sale_items` invocando `register_movement` (de S2-03) para registrar la salida (`kind='out'`, `ref_type='sale'`, `ref_id=sale_id`).
- Congela el `unit_cost` calculado por `register_movement` en cada fila de `sale_items`.
- Asigna `issued_at = now()`.
- Tests pgTAP para verificar la invariante de stock ≥ 0 (heredada de `register_movement`), congelamiento del costo y atomicidad.
- UI Básica (botón "Confirmar Venta" en el listado / detalle de ventas, con selector de bodega) si el humano decide incluirlo en esta sesión.

## NO-alcance (explícito)
- Despacho y entrega de la venta (S5-06).
- Asignación de número de recibo consecutivo o aplicación de pagos/caja (S5-08, S5-09, S5-04).
- Venta rápida / POS (S5-10, que empaquetará la creación, confirmación y pago en un solo paso).

## Criterios de aceptación
1. **Dado** una venta en estado `draft` **cuando** se invoca `confirm_sale` con una bodega de origen **entonces** la venta pasa a `status = 'confirmed'`, se asigna `issued_at = now()`.
2. **Dado** una confirmación exitosa **cuando** se revisa el kardex (`stock_movements`) y los `sale_items` **entonces** existe una salida por cada ítem de la venta y el `unit_cost` de `sale_items` coincide con el costo calculado al momento de la salida.
3. **Dado** un ítem cuya cantidad de venta supera el stock de la bodega **cuando** se intenta confirmar **entonces** la operación completa se revierte (atómica) y la venta sigue en `draft`.
4. **Dado** una venta ya confirmada, enviada o cancelada **cuando** se intenta confirmar nuevamente **entonces** es rechazada para evitar salidas duplicadas de stock.
5. **Dado** un tenant **cuando** invoca la confirmación con una venta o bodega ajena **entonces** la operación falla (aislamiento multitenant).

## Modelo de datos y migraciones
No hay tablas nuevas. Se crea una nueva función RPC.
Migración sugerida: `supabase/migrations/<timestamp>_confirm_sale.sql`

## Políticas RLS requeridas
- No se cambian políticas. `sales` y `sale_items` mantienen su RLS actual. La escritura ocurre solo dentro de la RPC `confirm_sale`, que corre como `security definer`.

## Funciones RPC e invariantes
- **`confirm_sale(p_sale_id uuid, p_warehouse_id uuid) returns void`** — `security definer`. Invariantes:
  1. `p_sale_id` y `p_warehouse_id` pertenecen al tenant del usuario (`user_tenant_ids()`).
  2. La venta debe estar en estado `draft`.
  3. Ejecuta `SELECT ... FOR UPDATE` sobre la fila de `sales` para evitar concurrencia.
  4. Llama a `register_movement` para cada ítem. Si alguna salida falla por falta de stock, la transacción completa falla.
  5. Actualiza `sale_items` asignando `unit_cost` basado en el resultado de la inserción de `register_movement`.

## Casos borde
- Venta sin ítems: actualiza a `confirmed` sin invocar movimientos de stock.
- Varios usuarios confirmando la misma venta concurrentemente (protegido por `FOR UPDATE`).
- Interacción con `register_movement`: El retorno de `register_movement` es el UUID del movimiento insertado. Se consultará dicho movimiento (`SELECT unit_cost FROM stock_movements WHERE id = ...`) para hacer el UPDATE en `sale_items.unit_cost`.

## Consideraciones de seguridad (docs/arch/seguridad.md)
- La RPC es `security definer`. Debe revalidar explícitamente que la venta y la bodega pertenecen al tenant autenticado, aunque reciba los IDs.
- Se setea el `search_path = public` en la RPC.

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 2 | pgTAP | supabase/tests/S5-03-confirm-sale.sql | `confirm_sale` feliz: actualiza a `confirmed`, crea movimientos `out`, congela `unit_cost` |
| 3 | pgTAP | supabase/tests/S5-03-confirm-sale.sql | Error por falta de stock revierte todo |
| 4 | pgTAP | supabase/tests/S5-03-confirm-sale.sql | Rechaza estado distinto a `draft` |
| 5 | pgTAP | supabase/tests/S5-03-confirm-sale.sql | Rechaza confirmar venta de otro tenant o usar bodega de otro tenant |

## Historial
- 2026-07-20 · creada (draft)
