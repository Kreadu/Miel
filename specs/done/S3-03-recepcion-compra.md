---
id: S3-03
titulo: Recepción de compra (receive_purchase)
estado: implemented
depende_de: [S3-02, S2-03]
---

# S3-03 — Recepción de compra

## Contexto y valor
Una orden `ordered` (S3-02) no afecta el inventario. Un operario necesita "recibirla" para que
el stock entre automáticamente, en una operación atómica: orden → `received` + un movimiento de
entrada por ítem (S2-03). Sin esto, el flujo de compras queda incompleto y el stock debe
ajustarse a mano.

## Alcance
- RPC `receive_purchase(p_purchase_id, p_warehouse_id)`: transiciona `ordered` → `received`,
  fija `received_at`, genera un `stock_movements` `kind='in'` por cada `purchase_item` (reusa
  `register_movement`, S2-03), todo o nada.
- Bodega destino: parámetro de la RPC (toda la orden entra a una sola bodega); sin cambio de
  esquema.
- Cualquier miembro del tenant (owner/admin/member) puede recibir — a diferencia de crear
  órdenes (solo admin).

## NO-alcance (explícito)
- UI de recepción (botón/formulario en `/(app)/compras/ordenes`) — historia de UI posterior.
- Bodega por ítem — se decidió una sola bodega por recepción (ver Historial).
- Cancelación/edición de orden no recibida (S3-04).
- Recepción parcial (recibir solo algunos ítems) — toda la orden se recibe de una vez.

## Criterios de aceptación
1. **Dado** un miembro del tenant y una orden `ordered` con N ítems **cuando** llama
   `receive_purchase(orden, bodega_válida)` **entonces** la orden pasa a `received`,
   `received_at` queda fijado, y se crean exactamente N `stock_movements` `kind='in'` con
   `ref_type='purchase'`, `ref_id=orden`, `qty`/`unit_cost` de cada ítem.
2. **Dado** una orden ya `received` **cuando** se llama `receive_purchase` de nuevo **entonces**
   rechaza (`purchase_not_ordered`), sin nuevos movimientos ni cambio de `received_at`.
3. **Dado** una orden `draft` o `cancelled` **cuando** se llama `receive_purchase`
   **entonces** rechaza (`purchase_not_ordered`).
4. **Dado** una bodega de otro tenant **cuando** se llama `receive_purchase`
   **entonces** rechaza (`warehouse_invalid`).
5. **Dado** dos tenants **cuando** un usuario intenta recibir una orden ajena
   **entonces** rechaza (`permission_denied`); y tras cualquier rechazo, el conteo de
   `stock_movements` y el estado de la orden quedan idénticos a antes (atomicidad).

## Modelo de datos y migraciones
Sin tablas nuevas. Usa `purchases` (`status`, `received_at`, ya presentes desde S3-02) y
`purchase_items`/`stock_movements` (ya existentes). Una sola migración con la función RPC +
grants.

## Políticas RLS requeridas
N/A — sin tablas nuevas. `receive_purchase` es `security definer` (mismo patrón que
`register_movement`/`create_purchase`: `purchases` y `stock_movements` solo tienen política de
SELECT, toda escritura entra por RPC que valida tenant/rol dentro de la función).

## Funciones RPC e invariantes
**`receive_purchase(p_purchase_id uuid, p_warehouse_id uuid) returns void`** — `security
definer`, `set search_path = public`. Invariantes:
1. Usuario autenticado (`not_authenticated` si no).
2. Orden existe (`purchase_not_found`) y el usuario pertenece a su tenant
   (`permission_denied`) — cualquier rol, no exige admin.
3. `p_warehouse_id` pertenece al mismo tenant (`warehouse_invalid`).
4. `status = 'ordered'` exactamente (`purchase_not_ordered` en cualquier otro caso: `draft`,
   `received`, `cancelled`) — invariante "no recibir dos veces".
5. Un `stock_movements` `kind='in'` por `purchase_item`, vía `register_movement` (hereda sus
   invariantes: costo, validación de producto/bodega), `ref_type='purchase'`,
   `ref_id=p_purchase_id::text`.
6. `status='received'`, `received_at=now()` al final.
7. Todo o nada: `for update` sobre la fila de `purchases` serializa recepciones concurrentes;
   cualquier `raise exception` revierte movimientos ya insertados y el update.

## Casos borde
- Orden `ordered` sin ítems: no puede ocurrir (`create_purchase` exige `p_items` no vacío) pero
  si ocurriera, el bucle no genera movimientos y la orden igual pasa a `received` (defensivo,
  no bloqueante).
- Dos recepciones concurrentes de la misma orden: `for update` serializa; la segunda ve
  `status='received'` y cae en `purchase_not_ordered`.
- Bodega inexistente: mismo camino que bodega de otro tenant (`warehouse_invalid`, sin fuga de
  existencia).

## Consideraciones de seguridad (docs/arch/seguridad.md)
- `tenant_id` nunca lo envía el cliente: se deriva de la orden (`purchases.tenant_id`).
- Errores `P0001` con mensaje interno; Server Action los mapea a español genérico (no se filtra
  detalle de Postgres).
- Boundary de servidor (`receivePurchase` action, cuando se implemente la UI): Zod valida
  `purchase_id`/`warehouse_id` como uuid antes de invocar la RPC.

## Plan de tests
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | pgTAP | supabase/tests/S3-03-receive-purchase.sql | recepción feliz: status/received_at/movimientos/qty exactos |
| 2 | pgTAP | supabase/tests/S3-03-receive-purchase.sql | recibir orden ya `received` → rechazo, sin duplicar movimientos |
| 3 | pgTAP | supabase/tests/S3-03-receive-purchase.sql | recibir `draft`/`cancelled` → rechazo |
| 4 | pgTAP | supabase/tests/S3-03-receive-purchase.sql | bodega de otro tenant → rechazo |
| 5 | pgTAP | supabase/tests/S3-03-receive-purchase.sql | orden ajena → rechazo; atomicidad (conteo antes=después tras fallo) |

## Historial
- 2026-07-20 · creada (draft). Decisiones confirmadas con el humano: bodega destino como
  parámetro de la RPC (no columna nueva); cualquier miembro del tenant puede recibir (no solo
  admin); solo se recibe desde `ordered` (draft/received/cancelled rechazados).
- 2026-07-20 · aprobada (draft → approved) por el humano. Se implementa con TDD a
  continuación.
- 2026-07-20 · implementada (approved → implemented). TDD real:
  `supabase/tests/S3-03-receive-purchase.sql` (12 tests pgTAP) escrito primero, verificado en
  rojo (`function public.receive_purchase(uuid, uuid) does not exist`); migración
  `supabase/migrations/20260720143947_receive-purchase.sql` después, en verde al primer intento
  (125/125 pgTAP: guardián + S1-01…S3-02 + S3-03). `receive_purchase` reusa `register_movement`
  (S2-03) dentro de un bucle sobre `purchase_items`, con `for update` sobre la fila de
  `purchases` para serializar recepciones concurrentes. Verificado: lint ✓, tsc ✓, tipos
  regenerados. Spec movida a `specs/done/`. BACKLOG S3-03 → `done`.
