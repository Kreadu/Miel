---
id: S5-04
titulo: Registrar pagos de clientes (cuentas por cobrar)
estado: implemented
depende_de: [S5-03]
---

# S5-04 — Registrar pagos de clientes (cuentas por cobrar)

## Contexto y valor
Con S5-03 (`confirm_sale`) en `done`, las ventas confirmadas generan una deuda del cliente
(salvo que se cobre de inmediato en caja, fuera de alcance aquí). El admin/gerente necesita
registrar los cobros recibidos y ver cuánto le debe cada cliente para planear su flujo de caja.
Es el espejo de S4-01+S4-02 (pagos a proveedores y CxP) del lado de ingresos, y la base
transaccional que S5-05 (ficha CRM) usará para el timeline de cliente.

Diferencia deliberada respecto a su espejo (`docs/arch/permisos-roles.md`, fila "Pagos de
clientes y CxC"): a diferencia de pagos a proveedores (solo admin/owner), **cualquier miembro
del tenant puede registrar un cobro** — quien vende también cobra. Pero el **saldo consolidado
por cliente (vista `customer_balances`) es visible solo a admin/owner**; un member ve únicamente
las ventas y pagos de su gestión, no el reporte financiero global de cartera.

## Alcance
- Tabla `customer_payments`.
- RPC `register_customer_payment` (atómica, verifica saldo si está atada a una venta).
- Vista `customer_balances` (saldo consolidado por cliente), restringida a admin/owner en su
  propia definición.
- UI: botón/formulario "Registrar cobro" en el listado de ventas (`/ventas/pedidos`), visible a
  todos los roles, para ventas con saldo pendiente. Página `/ventas/cuentas-por-cobrar` (listado
  de saldos), visible solo a admin/owner.
- Tests pgTAP (TDD) para invariantes, RLS y la restricción de rol de la vista.

## NO-alcance (explícito)
- Ficha CRM del cliente con timeline completo de ventas/pagos/interacciones (S5-05).
- Cobro dentro de una sesión de caja / POS (S5-09, S5-10) — aquí el cobro es un registro
  administrativo posterior a la venta, no un flujo de caja con arqueo.
- Descuentos, consecutivo de recibos (S5-08) y despacho (S5-06): no interactúan con esta
  historia más allá de que `sales.status` ya incluye esos valores en el `check` existente.

## Criterios de aceptación
1. **Dado** cualquier miembro del tenant (owner/admin/member) **cuando** registra un cobro
   asociado a una venta (`sale_id` presente) **entonces** se guarda si el monto es `> 0` y `≤`
   al saldo pendiente de esa venta (saldo = `sales.total` - suma de pagos previos de la venta).
2. **Dado** un miembro **cuando** intenta cobrar más del saldo de una venta **entonces** rechaza
   (`payment_exceeds_balance`).
3. **Dado** un miembro **cuando** registra un cobro general a un cliente (`sale_id` null)
   **entonces** se guarda si el monto es `> 0` (anticipo, no atado a una venta puntual).
4. **Dado** un miembro **cuando** registra un cobro a una venta que no pertenece al cliente
   indicado **entonces** rechaza (`sale_customer_mismatch`).
5. **Dado** un miembro **cuando** intenta cobrar una venta en estado `draft` o `cancelled`
   **entonces** rechaza (`sale_not_receivable`); solo son cobrables `confirmed`, `shipped` o
   `delivered`.
6. **Dado** un usuario de otro tenant **cuando** intenta registrar un cobro a un cliente ajeno
   **entonces** rechaza (`customer_not_found`, sin revelar existencia).
7. **Dado** un gerente (admin/owner) **cuando** visualiza `customer_balances` **entonces** ve el
   saldo actualizado de cada cliente (total ventas cobrables - total cobrado).
8. **Dado** un member **cuando** consulta `customer_balances` **entonces** no ve ninguna fila
   (restricción de rol, no solo de tenant).
9. **Dado** un usuario de otro tenant **cuando** consulta `customer_balances` **entonces** no ve
   los saldos de clientes ajenos (aislamiento).

## Modelo de datos y migraciones
Nueva migración `supabase/migrations/<timestamp>_customer_payments.sql` con tabla + RPC + vista.

### Tabla `customer_payments`
- `id` uuid primary key default `gen_random_uuid()`
- `tenant_id` uuid not null references `tenants(id)`
- `customer_id` uuid not null references `customers(id)`
- `sale_id` uuid null references `sales(id)`
- `amount` numeric(14,2) not null check (`amount > 0`)
- `paid_at` timestamptz not null default `now()`
- `method` text not null check (`method in ('cash','transfer','card','other')`)
- `note` text
- `created_by` uuid not null default `auth.uid()` references `auth.users(id)`
- `created_at` timestamptz not null default `now()`

Índices por `tenant_id`, `customer_id`, `sale_id`.

### Vista `customer_balances`
```sql
create or replace view public.customer_balances as
with sale_totals as (
  select customer_id, coalesce(sum(total), 0) as total_sales
  from public.sales
  where status in ('confirmed', 'shipped', 'delivered') and customer_id is not null
  group by customer_id
),
payment_totals as (
  select customer_id, coalesce(sum(amount), 0) as total_paid
  from public.customer_payments
  group by customer_id
)
select
  c.tenant_id,
  c.id as customer_id,
  c.name as customer_name,
  c.doc_number,
  coalesce(st.total_sales, 0) as total_sales,
  coalesce(pt.total_paid, 0) as total_paid,
  (coalesce(st.total_sales, 0) - coalesce(pt.total_paid, 0)) as balance
from public.customers c
left join sale_totals st on c.id = st.customer_id
left join payment_totals pt on c.id = pt.customer_id
where c.tenant_id in (select public.user_tenant_ids())
  and public.user_is_tenant_admin(c.tenant_id);
```

## Políticas RLS requeridas
- `customer_payments` — `SELECT`: `tenant_id in (select public.user_tenant_ids())`. Sin política
  de `INSERT`/`UPDATE`/`DELETE`: toda mutación entra por la RPC.
- `customer_balances` — vista sin RLS propia (el dueño hace bypass); aislamiento **y** rol
  garantizados explícitamente en su `WHERE` (ver arriba). Nota de seguridad: a diferencia de
  `supplier_balances` (donde cualquier rol del tenant puede ver saldos de CxP), aquí se agrega
  `user_is_tenant_admin` porque la matriz de permisos exige ocultar el saldo global a member.

## Funciones RPC e invariantes
**`register_customer_payment(p_customer_id uuid, p_sale_id uuid, p_amount numeric, p_method text, p_paid_at timestamptz, p_note text) returns uuid`**
- `security definer`, `set search_path = public`.
- Exige usuario autenticado (`not_authenticated`).
- Valida `p_amount > 0` (`payment_amount_invalid`) y `p_method` en el enum (`payment_method_invalid`).
- Deriva `tenant_id` desde `customers` (activo); si no existe o no pertenece al tenant del
  usuario, `customer_not_found` (sin distinguir "no existe" de "es de otro tenant").
- **No exige rol admin** (diferencia explícita con `register_supplier_payment`): cualquier
  miembro del tenant puede invocarla.
- Si `p_sale_id` no es null:
  - `select ... for update` sobre `sales` (serializa cobros concurrentes a la misma venta).
  - Si la venta no existe o es de otro tenant: `sale_not_found`.
  - Si `sales.customer_id <> p_customer_id`: `sale_customer_mismatch`.
  - Si `sales.status not in ('confirmed','shipped','delivered')`: `sale_not_receivable`.
  - Calcula `v_balance = sales.total - coalesce(sum(amount) from customer_payments where sale_id = p_sale_id, 0)`.
  - Si `p_amount > v_balance`: `payment_exceeds_balance`.
- Inserta en `customer_payments` con columnas explícitas. Retorna el `id`.

## Casos borde
- Cliente sin ventas ni pagos: no aparece en `customer_balances` filtrado, o aparece con
  `balance = 0` (permitido por `LEFT JOIN`/`COALESCE`, igual que el espejo).
- Pagos anticipados (`sale_id` null, ventas en 0): balance negativo (saldo a favor del cliente),
  igual que en `supplier_balances`.
- Ventas de mostrador (`customer_id` null): no participan de `customer_balances` (cobro va por
  caja, fuera de alcance).

## Consideraciones de seguridad (docs/arch/seguridad.md)
- `security definer` con `search_path` fijo y revalidación explícita de tenant dentro de la
  función (nunca confiar en el parámetro del cliente).
- Lección de S2-02/S4-02 aplicada: la vista repite el filtro de tenant y ahora también el de rol
  explícitamente en su propio `WHERE` — `FORCE ROW LEVEL SECURITY` no protege al dueño de la
  tabla en Supabase.
- Errores de la RPC mapeados a mensajes genéricos en español en el boundary de la Server Action.

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 2, 3 | pgTAP | supabase/tests/S5-04-pagos-clientes.sql | Cobro válido con y sin `sale_id`, rechazo por exceder saldo |
| 4, 5 | pgTAP | supabase/tests/S5-04-pagos-clientes.sql | `sale_customer_mismatch`, `sale_not_receivable` (draft/cancelled) |
| 1 (rol) | pgTAP | supabase/tests/S5-04-pagos-clientes.sql | Un member SÍ puede registrar el cobro (diferencia vs S4-01) |
| 6 | pgTAP | supabase/tests/S5-04-pagos-clientes.sql | Aislamiento: cliente de otro tenant → `customer_not_found` |
| 7, 9 | pgTAP | supabase/tests/S5-04-pagos-clientes.sql | `customer_balances`: cálculo correcto y aislamiento cross-tenant |
| 8 | pgTAP | supabase/tests/S5-04-pagos-clientes.sql | `customer_balances`: member no ve ninguna fila |
| — | pgTAP | supabase/tests/S5-04-pagos-clientes.sql | Escritura directa a `customer_payments` denegada por RLS |

## Historial
- 2026-07-20 · creada (draft), pendiente de aprobación humana.
- 2026-07-20 · aprobada por el humano (draft → approved). Inicia TDD.
- 2026-07-20 · implementada con TDD: pgTAP en rojo→verde (218/218 suite completa), migración
  `20260720182405_customer_payments.sql` (tabla + RPC + vista), acción `registerCustomerPayment`
  y UI (`PaymentForm` en pedidos, página `/ventas/cuentas-por-cobrar` gated a no-member).
  lint ✓, tsc ✓, Vitest 103/103 ✓. Movida a `specs/done/`.
