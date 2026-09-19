---
id: S5-02
titulo: Crear ventas con ítems (borrador)
estado: implemented
depende_de: [S5-01, S2-02]
---

# S5-02 — Ventas en borrador

## Contexto y valor
Con clientes (S5-01) y productos (S2-02) listos, un vendedor necesita registrar pedidos: qué le
vende a qué cliente (o a mostrador, sin cliente), cuánto y a qué precio. Es la primera historia
de Ventas con lógica transaccional real — los totales (`subtotal`, `tax`, `total`) deben
calcularse en Postgres, nunca en el cliente, igual que `create_purchase` (S3-02). Prepara el
terreno para S5-03 (confirmar la venta → sale el stock, se congela el costo).

A diferencia de Compras, aquí **cualquier miembro del tenant** puede crear ventas (matriz
`docs/arch/permisos-roles.md`: "Crear ventas, POS (vender, cobrar), despachar" es ✔ para
`owner`/`admin`/`member` — solo cancelar y ver saldos globales están restringidos a admin) y el
cliente es **opcional** (venta de mostrador).

## Alcance
- Tablas `sales` (cabecera) y `sale_items` (detalle), con **todas las columnas del ciclo de
  ventas completo** del modelo de datos (`docs/data-model.md`, Épica E5) desde ya, aunque esta
  historia solo llene las de un borrador — decisión confirmada con el humano para no volver a
  alterar la tabla en cada historia siguiente (S5-03/06/08/09 activan su *lógica*, no su
  columna).
- RPC `create_sale(p_tenant_id, p_items, p_customer_id, p_note)`: crea cabecera + ítems de forma
  atómica, calculando `subtotal`/`tax`/`total` en BD. Nace siempre en `status='draft'`.
- UI en `/(app)/ventas/pedidos`: listado (nº, cliente o "Mostrador", estado, total, fecha) y
  formulario de creación con selector de cliente opcional y líneas de ítems dinámicas
  (agregar/quitar antes de enviar).
- Enlace "Pedidos" desde `/(app)/ventas`.
- Crear ventas permitido a **owner/admin/member** (matriz de permisos). Aislamiento por tenant
  en select y en la RPC.

## NO-alcance (explícito)
- Confirmar la venta, salida de stock y congelado de `unit_cost` (`confirm_sale`, S5-03).
- Editar ítems de una venta ya creada — no hay historia dedicada aún; se decide al llegar.
- Cancelar ventas (S5-06 define transiciones válidas; solo admin, matriz de permisos).
- Pagos de clientes y CxC (S5-04).
- Descuentos por ítem en UI y consecutivo de recibo (`receipt_number`) — la columna `discount`
  y `receipt_number` existen en la tabla pero esta RPC no las asigna (S5-08).
- Congelado de costo (`unit_cost` de `sale_items`) — la columna existe pero queda `null` hasta
  S5-03.
- Caja (`cash_session_id`), despacho (`shipping_address`/`shipped_at`/`delivered_at`) — columnas
  presentes, sin lógica ni UI en esta historia (S5-09/S5-06 respectivamente).

## Criterios de aceptación
1. **Dado** un usuario (cualquier rol) del tenant activo **cuando** crea una venta con un
   cliente y 2 ítems válidos **entonces** la venta y sus ítems quedan registrados y
   `subtotal`/`tax`/`total` son exactamente `Σ qty·unit_price`, `Σ qty·unit_price·tax_rate/100`
   y su suma, calculados en la RPC (no en el cliente); `status='draft'`.
2. **Dado** un usuario **cuando** crea una venta sin seleccionar cliente **entonces** la venta se
   registra igual con `customer_id = null` (venta de mostrador).
3. **Dado** un `member` **cuando** invoca `create_sale` **entonces** la operación se acepta (a
   diferencia de compras, no requiere rol admin — solo pertenencia al tenant).
4. **Dado** un usuario **cuando** intenta crear una venta sin ítems, con algún ítem de
   `qty ≤ 0` o `unit_price < 0`, o referenciando un producto/cliente de otro tenant o inactivo
   **entonces** la operación es rechazada completa (atómica: nada queda insertado) con un
   mensaje claro.
5. **Dado** dos tenants con ventas propias **cuando** cualquier usuario consulta el listado o
   intenta crear una venta con un `customer_id`/`product_id` ajeno **entonces** solo ve/opera
   sobre las ventas y catálogos de su(s) tenant(s) (aislamiento probado en pgTAP).

## Modelo de datos y migraciones
Según `docs/data-model.md` (Ventas, E5); tipos por `docs/arch/convenciones-sql.md` (dinero
`numeric(14,2)`, cantidades `numeric(14,3)`):

```sql
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  issued_at timestamptz,
  subtotal numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  receipt_number integer,
  cash_session_id uuid,
  shipping_address text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  note text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  qty numeric(14,3) not null check (qty > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  tax_rate numeric(5,2) not null default 0,
  unit_cost numeric(14,2),
  created_at timestamptz not null default now()
);

create index sales_tenant_id_idx on public.sales (tenant_id);
create index sales_customer_id_idx on public.sales (customer_id);
create index sale_items_tenant_id_idx on public.sale_items (tenant_id);
create index sale_items_sale_id_idx on public.sale_items (sale_id);
create index sale_items_product_id_idx on public.sale_items (product_id);

create trigger sales_set_updated_at
  before update on public.sales
  for each row execute function public.set_updated_at();
```

Notas sobre columnas de historias futuras (no cerrar puertas sin implementar de más):
- `cash_session_id` **sin FK** — la tabla `cash_sessions` no existe todavía; se agrega por
  `ALTER TABLE ... ADD CONSTRAINT` en S5-09 cuando la tabla exista (forward-only).
- `receipt_number`, `sale_items.unit_cost`, `sale_items.discount`: columnas existen pero
  `create_sale` no las asigna (quedan `null`/`0`); su mecánica (consecutivo, congelado de costo,
  UI de descuento) es de S5-08/S5-03/S5-08 respectivamente.
- `shipping_address`/`shipped_at`/`delivered_at`: sin UI ni lógica en esta historia (S5-06).

Todo en una sola migración (tablas + RLS + políticas + índices + trigger + RPC + GRANT),
forward-only.

## Políticas RLS requeridas
Patrón `docs/arch/multitenancy-rls.md`, espejo de `purchases` (S3-02): la escritura vive
**solo** en la RPC, nunca vía `supabase-js` directo.
- `sales_tenant_select` / `sale_items_tenant_select` — `for select using (tenant_id in (select
  user_tenant_ids()))`: visible a todo el equipo del tenant.
- **Sin políticas de insert/update/delete** en ninguna de las dos tablas: toda escritura entra
  por `create_sale` (`security definer`), que valida **pertenencia al tenant** (no admin, a
  diferencia de `create_purchase`) explícitamente dentro de la función.
- `grant select on public.sales, public.sale_items to authenticated, service_role;`

## Funciones RPC e invariantes
- **`create_sale(p_tenant_id uuid, p_items jsonb, p_customer_id uuid default null, p_note text
  default null) returns uuid`** — `security definer`. Invariantes:
  1. Usuario autenticado (`auth.uid()` no null); si no, `not_authenticated`.
  2. `p_tenant_id in (select user_tenant_ids())` — el usuario pertenece al tenant (cualquier
     rol: owner/admin/member); si no, `permission_denied`.
  3. Si `p_customer_id` no es null: pertenece a `p_tenant_id` y está `active`; si no,
     `customer_invalid`. `p_customer_id` null es válido (venta de mostrador).
  4. `p_items` es un array JSON con **al menos 1 elemento** (`items_required`); cada elemento
     con `product_id`, `qty > 0` (`item_qty_invalid`), `unit_price ≥ 0`
     (`item_unit_price_invalid`), `tax_rate` opcional (default 0); cada `product_id` pertenece
     a `p_tenant_id` y está `active` (`product_invalid`).
  5. `subtotal = Σ qty·unit_price`, `tax = Σ qty·unit_price·tax_rate/100`, `total = subtotal +
     tax` — calculados en la función, nunca recibidos del cliente.
  6. Nace `status = 'draft'`, `issued_at = null` (se fija al confirmar, S5-03).
  7. Todo o nada: cualquier violación revierte la cabecera y los ítems ya insertados
     (transacción implícita de la función).

`p_tenant_id` lo determina el servidor con `getActiveTenant()` (nunca el `FormData` del
cliente) antes de invocar la RPC, pero la RPC igual revalida pertenencia — el `security
definer` no puede confiar en el parámetro por sí solo.

## Casos borde
- Venta sin ítems (`p_items = '[]'`) → rechazada, nada se inserta.
- Ítem con `qty ≤ 0` o `unit_price < 0` → rechazado por el `check` de la tabla (y validado antes
  en la RPC para dar un mensaje claro en vez de un error crudo de constraint).
- `customer_id` o algún `product_id` de otro tenant → rechazado (mensaje genérico, sin
  distinguir "no existe" de "no es tuyo").
- Cliente o producto archivado (`active = false`) → rechazado.
- `p_customer_id = null` → venta de mostrador válida, sin error.
- Redondeo de `tax`: igual que compras, se calcula con la precisión de `numeric(14,2)`
  directamente en la suma, sin redondeos intermedios por ítem.

## Consideraciones de seguridad (docs/arch/seguridad.md)
- Boundary de servidor (`createSale`): Zod valida forma y tipos antes de invocar la RPC
  (`customer_id` uuid opcional, `items` array no vacío con tipos correctos) — la RPC es la
  frontera real de negocio.
- `tenant_id` nunca lo decide el cliente: el servidor lo resuelve con `getActiveTenant()` contra
  `memberships`; la RPC revalida pertenencia igual (defensa en profundidad, mismo patrón que
  `create_purchase`).
- La app **nunca calcula ni envía** `subtotal`/`tax`/`total`: siempre los devuelve la RPC.
- Errores de Postgres (`P0001` de invariante) se mapean a mensajes genéricos en español — nunca
  se filtra el detalle interno.

## Plan de tests
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | pgTAP | supabase/tests/S5-02-ventas-borrador.sql | `create_sale` con 2 ítems → subtotal/tax/total exactos, status=draft |
| 2 | pgTAP | supabase/tests/S5-02-ventas-borrador.sql | `customer_id = null` → venta de mostrador válida |
| 3 | pgTAP | supabase/tests/S5-02-ventas-borrador.sql | `member` sí puede invocar `create_sale` (a diferencia de compras) |
| 4 | pgTAP | supabase/tests/S5-02-ventas-borrador.sql | sin ítems, qty≤0, unit_price<0, cliente/producto ajeno o inactivo → rechazado y nada persiste |
| 5 | pgTAP | supabase/tests/S5-02-ventas-borrador.sql | aislamiento cruzado entre 2 tenants (select y RPC) |
| 1, 4 | Vitest | src/lib/validation/sales.test.ts | schema Zod: ítems válidos/vacíos, qty/unit_price/tax_rate fuera de rango, customer_id ausente aceptado |

## Historial
- 2026-07-20 · creada (draft) tras cerrar S5-01. Decisiones confirmadas con el humano: alcance
  full-stack con UI en la misma sesión; `sales`/`sale_items` nacen con todas las columnas del
  ciclo de ventas completo (nullable las de fases futuras) para no volver a alterar la tabla en
  cada historia siguiente — la lógica de esas columnas se activa en S5-03/06/08/09.
- 2026-07-20 · aprobada (draft → approved) por el humano. Se implementa con TDD a continuación.
- 2026-07-20 · implementada (approved → implemented). TDD real: pgTAP
  (`supabase/tests/S5-02-ventas-borrador.sql`, 18 tests) y Vitest (`sales.test.ts`, 9 tests)
  escritos primero y verificados en rojo (`relation "public.sales" does not exist` /
  `function public.create_sale(...) does not exist`); migración
  `supabase/migrations/20260720180000_sales.sql` después, en verde al primer intento
  (188/188 pgTAP: guardián + S1-01…S5-01 + S5-02). Tablas `sales` + `sale_items` con **todas**
  las columnas del ciclo de ventas (E5) desde ya — `receipt_number`, `sale_items.unit_cost`,
  `sale_items.discount`, `cash_session_id` (sin FK, tabla `cash_sessions` aún no existe),
  `shipping_address`/`shipped_at`/`delivered_at` — con RLS de **solo lectura** (sin política de
  insert/update/delete): toda escritura entra por `create_sale` (`security definer`), que
  valida **pertenencia al tenant** (no rol admin, a diferencia de `create_purchase`/S3-02:
  cualquier miembro vende, matriz `permisos-roles.md`). `create_sale(p_tenant_id, p_items,
  p_customer_id, p_note)` calcula `subtotal`/`tax`/`total` iterando `p_items` (jsonb) dentro de
  la función, nunca en el cliente; `p_customer_id` es opcional (null = venta de mostrador);
  rechaza cliente/producto inactivo o de otro tenant, ítems vacíos, `qty≤0`/`unit_price<0`,
  todo o nada. `src/actions/sales.ts` (`createSale`, `p_tenant_id` resuelto en servidor con
  `getActiveTenant()` — nunca del cliente —, normaliza el sentinel `__counter__` del selector
  "Mostrador" del formulario a ausente, mapeo de errores a español genérico).
  `src/lib/validation/sales.ts` (Zod: `customer_id` opcional/nullable, `items.min(1)`). UI
  `/(app)/ventas/pedidos`: listado con embed PostgREST del cliente (`select('*, customers(name)')`,
  sin N+1, "Mostrador" si `customer_id` es null), `SaleForm` con selector de cliente opcional +
  líneas de ítems dinámicas (pre-llena precio/IVA desde `products_catalog`, total previsualizado
  en cliente solo como ayuda visual — la BD es la fuente de verdad), un botón "Crear borrador"
  visible a **cualquier rol** (a diferencia de compras, sin gating por `role !== "member"`).
  Enlace "Pedidos" agregado a `src/app/(app)/ventas/page.tsx`.
  Verificado: lint ✓, tsc ✓, Vitest 95/95 ✓ (incluye `sales.test.ts` 9/9), `supabase test db`
  188/188 ✓, tipos regenerados (`src/lib/database.types.ts`, incluye `sales`/`sale_items`/
  `create_sale`), `next dev` arranca sin error (200 en `/`). Spec movida a `specs/done/`.
  BACKLOG S5-02 → `done`.
