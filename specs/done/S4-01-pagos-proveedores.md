---
id: S4-01
titulo: Registrar pagos a proveedores
estado: implemented
depende_de: [S3-03]
---

# S4-01 — Registrar pagos a proveedores

## Contexto y valor
Para tener control sobre el flujo de caja y las cuentas por pagar (CxP), el sistema debe permitir registrar los abonos o pagos totales que se realizan a los proveedores. Un pago puede estar asociado directamente a una orden de compra específica o ser un abono general a la cuenta del proveedor. Esta es la base transaccional de las salidas de dinero (junto con los gastos).

## Alcance
- Crear la tabla `supplier_payments`.
- RPC `register_supplier_payment` (atómica, verifica saldos).
- Políticas RLS por rol: `select` para todo el tenant, `insert`/`update` delegados a la RPC (solo `admin`/`owner`).
- Tests pgTAP (TDD) para validar invariantes y RLS.

## NO-alcance (explícito)
- UI de registro de pagos (historia posterior).
- Vistas de saldos acumulados o cuentas por pagar (`supplier_balances`), que son el foco de S4-02.
- Manejo de caja chica o sesiones de caja (esto es para ventas mostrador E5).

## Criterios de aceptación
1. **Dado** un admin **cuando** registra un pago asociado a una compra (`purchase_id` presente) **entonces** el pago se guarda exitosamente si el monto es `> 0` y `≤` al saldo pendiente de esa compra (saldo = total - sum(pagos previos de la compra)).
2. **Dado** un admin **cuando** intenta pagar más del saldo de una compra **entonces** rechaza (`payment_exceeds_balance`).
3. **Dado** un admin **cuando** registra un pago general a un proveedor (`purchase_id` null) **entonces** el pago se guarda exitosamente si el monto es `> 0`.
4. **Dado** un admin **cuando** registra un pago a una compra que no pertenece al proveedor indicado **entonces** rechaza (`purchase_supplier_mismatch`).
5. **Dado** un miembro (`member`) **cuando** intenta usar `register_supplier_payment` **entonces** rechaza (`permission_denied`).
6. **Dado** un usuario de otro tenant **cuando** intenta registrar un pago a un proveedor ajeno **entonces** rechaza (`permission_denied`).
7. **Dado** un admin **cuando** intenta pagar una compra en estado `draft` o `cancelled` **entonces** rechaza (`purchase_not_payable`); solo son pagables las compras `ordered` o `received`.

## Modelo de datos y migraciones
Nueva tabla `supplier_payments` (en una sola migración junto con la RPC):
- `id` uuid primary key
- `tenant_id` uuid not null
- `supplier_id` uuid not null (fk a `suppliers`)
- `purchase_id` uuid null (fk a `purchases`)
- `amount` numeric(14,2) not null check (amount > 0)
- `paid_at` timestamptz not null default now()
- `method` text not null check (method in ('cash', 'transfer', 'card', 'other'))
- `note` text
- `created_by` uuid, `created_at` timestamptz

## Políticas RLS requeridas
- `SELECT`: `tenant_id in (select public.user_tenant_ids())`.
- `INSERT`/`UPDATE`/`DELETE`: Sin política. Toda mutación se hace por medio de la RPC. 
  *(Nota de seguridad: Ningún rol puede insertar directamente).*

## Funciones RPC e invariantes
**`register_supplier_payment(p_supplier_id uuid, p_purchase_id uuid, p_amount numeric, p_method text, p_paid_at timestamptz, p_note text) returns uuid`**
- `security definer`, `set search_path = public`.
- Validar `p_amount > 0`.
- Validar admin del tenant (`user_is_tenant_admin(v_tenant_id)`).
- Validar que el proveedor pertenezca al tenant del usuario (`supplier_not_found`).
- Si `p_purchase_id` no es null:
  - Bloquear la fila de la compra con `select ... for update` (evita condición de carrera entre
    pagos concurrentes sobre la misma orden).
  - Verificar que la compra pertenezca al `p_supplier_id` (`purchase_supplier_mismatch`).
  - Verificar que `status in ('ordered', 'received')` (`purchase_not_payable`).
  - Calcular `v_balance = purchases.total - (select coalesce(sum(amount), 0) from supplier_payments where purchase_id = p_purchase_id)`.
  - Validar `p_amount <= v_balance` (`payment_exceeds_balance`).
- Insertar en `supplier_payments`.
- Retornar el `id` del pago creado.

## Consideraciones de seguridad (docs/arch/seguridad.md)
- La inserción usa `auth.uid()` para `created_by` y el `tenant_id` se deriva validando el proveedor.
- Errores genéricos mapeables en UI.

## Plan de tests
- pgTAP `S4-01-pagos-proveedores.sql` con cobertura completa de invariantes, validación RLS en modo lectura y restricción absoluta de escritura directa (ver trampa de RLS en SKILL.md).

## Historial
- 2026-07-20 · creada (draft), aprobada por el humano e implementada con TDD en la misma sesión.
- 2026-07-20 · auditoría pre-commit: se agregó `for update` al select de `purchases` en
  `register_supplier_payment` para cerrar una race condition (dos pagos concurrentes podían
  superar el saldo antes de que ninguno hiciera commit). Además se agregó el criterio 7 y la
  validación `purchase_not_payable`: ya no se puede pagar una compra `draft` o `cancelled`.
