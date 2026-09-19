---
id: S4-02
titulo: Cuentas por pagar y saldos por proveedor
estado: implemented
depende_de: [S4-01]
---

# S4-02 — Cuentas por pagar y saldos por proveedor

## Contexto y valor
Para planear la caja y mantener buena relación con los proveedores, el gerente necesita visualizar de manera rápida cuánto se debe a cada proveedor, así como el historial detallado de compras y pagos de un proveedor específico.

## Alcance
- Crear la vista `supplier_balances` que consolide `total_purchases`, `total_paid` y `balance` por proveedor.
- Crear la página UI `/(app)/compras/cuentas-por-pagar` que liste los saldos por proveedor (usando la vista).
- Crear la página UI `/(app)/compras/proveedores/[id]/cuenta` (o expandir la vista del proveedor) para ver el detalle cronológico de sus compras (ordenadas/recibidas) y pagos.
- Tests pgTAP (TDD) para validar los cálculos de la vista y el aislamiento (multitenancy).

## NO-alcance (explícito)
- Generación de reportes PDF o exportación a Excel.
- Cuentas por cobrar de clientes (pertenece a la Épica 5).
- Alertas automatizadas de fechas de vencimiento de pago (solo se maneja el saldo global por ahora).

## Criterios de aceptación
1. **Dado** un gerente **cuando** visualiza la lista de cuentas por pagar **entonces** ve el saldo actualizado de cada proveedor (total compras - total pagos).
2. **Dado** el cálculo de saldos **cuando** hay compras en estado `draft` o `cancelled` **entonces** no suman al total de deuda (solo `ordered` o `received`).
3. **Dado** un gerente **cuando** entra al detalle de un proveedor **entonces** ve el listado de sus compras pagables y el historial de pagos realizados.
4. **Dado** un usuario de otro tenant **cuando** consulta la vista `supplier_balances` **entonces** no puede ver los saldos del tenant ajeno (aislamiento explícito en la vista).

## Modelo de datos y migraciones
Nueva vista `supplier_balances` (en una migración nueva):
```sql
CREATE OR REPLACE VIEW public.supplier_balances AS
WITH purchase_totals AS (
    SELECT supplier_id, COALESCE(SUM(total), 0) AS total_purchases
    FROM public.purchases
    WHERE status IN ('ordered', 'received')
    GROUP BY supplier_id
),
payment_totals AS (
    SELECT supplier_id, COALESCE(SUM(amount), 0) AS total_paid
    FROM public.supplier_payments
    GROUP BY supplier_id
)
SELECT
    s.tenant_id,
    s.id AS supplier_id,
    s.name AS supplier_name,
    s.nit AS supplier_nit,
    COALESCE(pt.total_purchases, 0) AS total_purchases,
    COALESCE(pay.total_paid, 0) AS total_paid,
    (COALESCE(pt.total_purchases, 0) - COALESCE(pay.total_paid, 0)) AS balance
FROM public.suppliers s
LEFT JOIN purchase_totals pt ON s.id = pt.supplier_id
LEFT JOIN payment_totals pay ON s.id = pay.supplier_id
WHERE s.tenant_id IN (SELECT public.user_tenant_ids());
```

## Políticas RLS requeridas
- Al ser una vista, no usa RLS directo (el dueño hace bypass). El aislamiento multitenant está garantizado por la cláusula explícita `WHERE s.tenant_id IN (SELECT public.user_tenant_ids())`.

## Funciones RPC e invariantes
- N/A (Solo consultas).

## Casos borde
- Proveedor sin compras ni pagos: Debe aparecer con balance 0 (el `LEFT JOIN` y los `COALESCE` lo manejan).
- Proveedor con pagos anticipados (pagos sin `purchase_id` sumados, compras en 0): El balance será negativo (saldo a favor del tenant). La vista lo soporta correctamente.

## Consideraciones de seguridad (docs/arch/seguridad.md)
- La vista restringe los datos al tenant activo mediante `user_tenant_ids()`.
- En UI, los datos de la vista son read-only.
- Si un miembro consulta, verá las cuentas (si el rol se lo permite según los requisitos de negocio). En este proyecto los saldos financieros de compras no tienen la misma restricción fuerte que el costo en el kardex, pero los roles se aplicarán en UI según el estándar (se puede ocultar o mostrar a members según `docs/arch/permisos-roles.md`, asumiendo que members no ven "reportes financieros" completos).

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 2 | pgTAP | supabase/tests/S4-02-cuentas-por-pagar.sql | Cálculos de `total_purchases` (solo ordered/received), `total_paid` y `balance` correcto incluyendo pagos anticipados. |
| 4 | pgTAP | supabase/tests/S4-02-cuentas-por-pagar.sql | Aislamiento: tenant nuevo no ve las filas de la vista correspondientes a otro tenant. |

## Historial
- 2026-07-20 · creada (draft)
