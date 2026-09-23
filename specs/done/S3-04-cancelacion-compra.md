---
id: S3-04
titulo: Cancelación y edición de orden de compra
estado: implemented
depende_de: [S3-03]
---

# S3-04 — Cancelación y edición de compra

## Contexto y valor
Los administradores necesitan corregir errores en las órdenes de compra (cantidades, proveedor, costos) o cancelarlas completamente si el proveedor no las puede surtir. Esto debe poder hacerse siempre y cuando la orden no haya sido "recibida" (S3-03), ya que una vez recibida, el stock ya ingresó al kardex y la operación es inmutable desde el punto de vista de la orden.

## Alcance
- RPC `cancel_purchase(p_purchase_id)`: Transiciona la orden a estado `cancelled`. Permitido solo si el estado actual es `draft` u `ordered`.
- RPC `update_purchase(p_purchase_id, p_supplier_id, p_items jsonb, p_note)`: Edita una orden existente (reemplaza proveedor, nota e ítems, recalculando totales). Permitido solo si el estado actual es `draft` u `ordered`.
- Restricción: No se puede cancelar ni editar una orden en estado `received` (ni tampoco revivir una `cancelled`).

## NO-alcance (explícito)
- UI de los formularios (historia posterior).
- Devoluciones de stock: Si una orden ya se recibió y se quiere devolver, se requerirá un movimiento de stock manual o una funcionalidad de devolución en el futuro. S3-04 NO toca órdenes `received`.

## Criterios de aceptación
1. **Dado** un admin del tenant y una orden `draft` u `ordered` **cuando** llama `cancel_purchase` **entonces** la orden pasa a `cancelled`.
2. **Dado** una orden ya `received` **cuando** llama `cancel_purchase` **entonces** rechaza (`purchase_not_cancellable`).
3. **Dado** un admin del tenant y una orden `draft` u `ordered` **cuando** llama `update_purchase` con nuevos ítems **entonces** la cabecera se actualiza, los ítems anteriores se borran, se insertan los nuevos, y los totales (`subtotal`, `tax`, `total`) se recalculan correctamente en BD.
4. **Dado** una orden `received` o `cancelled` **cuando** llama `update_purchase` **entonces** rechaza (`purchase_not_updatable`).
5. **Dado** un `member` **cuando** intenta cancelar o editar **entonces** rechaza (`permission_denied`) porque solo admin/owner puede gestionar compras.

## Modelo de datos y migraciones
- Sin tablas nuevas.
- `update_purchase` requiere borrar los registros hijos (`DELETE FROM purchase_items WHERE purchase_id = X`) y volver a insertarlos desde el `p_items` jsonb, idéntico a `create_purchase`. (La FK tiene `on delete cascade` así que se pueden borrar, o se borran explícitamente).

## Políticas RLS requeridas
N/A. Se mantendrán las políticas de SELECT. La modificación se hará 100% mediante las funciones RPC `security definer`.

## Funciones RPC e invariantes
**`cancel_purchase(p_purchase_id uuid) returns void`**
- `security definer`.
- Validar admin del tenant.
- Validar `status in ('draft', 'ordered')`.
- Actualiza `status = 'cancelled'`.

**`update_purchase(p_purchase_id uuid, p_supplier_id uuid, p_items jsonb, p_note text) returns void`**
- `security definer`.
- Validar admin del tenant.
- Validar `status in ('draft', 'ordered')`.
- Validar proveedor activo y del mismo tenant.
- Validar ítems (qty > 0, cost >= 0, producto válido, activo y del tenant).
- `DELETE FROM purchase_items WHERE purchase_id = p_purchase_id;`
- Insertar los nuevos ítems.
- `UPDATE purchases SET supplier_id = ..., note = ..., subtotal = ..., tax = ..., total = ...`
- Si la orden estaba `ordered`, su `issued_at` no cambia. Si estaba `draft`, sigue `draft`.

## Consideraciones de seguridad
- `tenant_id` se deriva de la BD.
- Solo admins pueden ejecutar las RPCs.

## Historial
- 2026-07-20 · creada (draft), aprobada por el humano e implementada con TDD en la misma sesión.
