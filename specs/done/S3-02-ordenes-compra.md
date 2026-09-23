---
id: S3-02
titulo: Órdenes de compra con ítems
estado: implemented
depende_de: [S3-01, S2-02]
---

# S3-02 — Órdenes de compra

## Contexto y valor
Con proveedores (S3-01) y productos (S2-02) ya listos, un admin necesita registrar sus
pedidos de compra: qué le pide a qué proveedor, cuánto y a qué costo. Es la primera historia
de Compras con lógica transaccional real — los totales (`subtotal`, `tax`, `total`) deben
calcularse en Postgres, nunca en el cliente, para que no puedan falsificarse ni desincronizarse
del detalle de ítems. Prepara el terreno para S3-03 (recibir la compra → entra el stock).

## Alcance
- Tablas `purchases` (cabecera) y `purchase_items` (detalle).
- RPC `create_purchase(p_supplier_id, p_status, p_items, p_note)`: crea cabecera + ítems de
  forma atómica, calculando `subtotal`/`tax`/`total` en BD. `p_status` es `'draft'` u
  `'ordered'` — la orden nace directamente en el estado elegido; si nace `'ordered'`, fija
  `issued_at = now()`.
- RPC ligera `mark_purchase_ordered(p_purchase_id)`: transiciona una orden `draft` existente a
  `ordered`, fijando `issued_at`.
- UI en `/(app)/compras/ordenes`: listado (nº, proveedor, estado, total, fecha) y formulario de
  creación con líneas de ítems dinámicas (agregar/quitar antes de enviar).
- Enlace "Órdenes de compra" desde `/(app)/compras`.
- Crear órdenes y marcarlas como `ordered` restringido a **owner/admin** (matriz
  `permisos-roles.md`: "Crear/editar órdenes de compra" ✖ member). Listado visible a todos los
  roles (member sí opera compras al **recibirlas**, S3-03).

## NO-alcance (explícito)
- Editar los ítems de una orden ya creada (agregar/quitar líneas, cambiar cantidades/costos) —
  es el criterio explícito de S3-04 ("corregir una orden no recibida").
- Recepción de la compra y entrada de stock (`receive_purchase`, S3-03).
- Cancelación de órdenes (S3-04).
- Pagos a proveedores y saldo pendiente (E4).
- Numeración consecutiva de orden (no es un requisito de negocio para compras, a diferencia
  del `receipt_number` de ventas en S5-08); se identifica por `id` únicamente.

## Criterios de aceptación
1. **Dado** un owner/admin **cuando** crea una orden con 2 ítems válidos **entonces** la orden
   y sus ítems quedan registrados y `subtotal`/`tax`/`total` son exactamente
   `Σ qty·unit_cost`, `Σ qty·unit_cost·tax_rate/100` y su suma, calculados en la RPC (no en el
   cliente).
2. **Dado** un owner/admin **cuando** crea la orden eligiendo estado `ordered`
   **entonces** `issued_at` queda fijado en el momento de creación; si la crea como `draft`,
   `issued_at` queda `null` hasta que la marque como `ordered` con `mark_purchase_ordered`.
3. **Dado** un `member` **cuando** intenta invocar `create_purchase` o
   `mark_purchase_ordered` **entonces** la RPC rechaza la operación (validación explícita de
   rol admin dentro de la función, ya que corre `security definer`); el `member` sí puede
   **ver** el listado de órdenes.
4. **Dado** un owner/admin **cuando** intenta crear una orden sin ítems, o con algún ítem de
   `qty ≤ 0`, o referenciando un producto/proveedor de otro tenant **entonces** la operación es
   rechazada completa (atómica: nada queda insertado) con un mensaje claro.
5. **Dado** dos tenants con órdenes propias **cuando** cualquier usuario consulta el listado o
   intenta crear una orden con un `supplier_id`/`product_id` ajeno **entonces** solo ve/opera
   sobre las órdenes y catálogos de su(s) tenant(s) (aislamiento probado en pgTAP).

## Modelo de datos y migraciones
Según `docs/data-model.md` (Compras); tipos por `docs/arch/convenciones-sql.md` (dinero
`numeric(14,2)`, cantidades `numeric(14,3)`):

```sql
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'ordered', 'received', 'cancelled')),
  issued_at timestamptz,
  received_at timestamptz,
  subtotal numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  note text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  qty numeric(14,3) not null check (qty > 0),
  unit_cost numeric(14,2) not null check (unit_cost >= 0),
  tax_rate numeric(5,2) not null default 0,
  created_at timestamptz not null default now()
);

create index purchases_tenant_id_idx on public.purchases (tenant_id);
create index purchases_supplier_id_idx on public.purchases (supplier_id);
create index purchase_items_tenant_id_idx on public.purchase_items (tenant_id);
create index purchase_items_purchase_id_idx on public.purchase_items (purchase_id);
create index purchase_items_product_id_idx on public.purchase_items (product_id);

create trigger purchases_set_updated_at
  before update on public.purchases
  for each row execute function public.set_updated_at();
```

`received`/`cancelled` existen en el `check` constraint desde ya (no cerrar la puerta a
S3-03/S3-04) pero esta historia no los produce ni los consume.

Todo en una sola migración (tablas + RLS + políticas + índices + trigger + RPCs + GRANT),
forward-only.

## Políticas RLS requeridas
Patrón `docs/arch/multitenancy-rls.md`, espejo de `stock_movements` (S2-03): la escritura vive
**solo** en las RPCs, nunca vía `supabase-js` directo.
- `purchases_tenant_select` / `purchase_items_tenant_select` — `for select using (tenant_id in
  (select user_tenant_ids()))`: visible a todo el equipo del tenant.
- **Sin políticas de insert/update/delete** en ninguna de las dos tablas: toda escritura entra
  por `create_purchase`/`mark_purchase_ordered` (`security definer`), que valida el rol admin
  explícitamente dentro de la función — necesario porque `security definer` bypassa RLS, así
  que la autorización de rol no puede delegarse a una política de la tabla (mismo patrón que
  `register_movement`, que también centraliza la escritura de un libro con RLS de solo
  lectura).
- `grant select on public.purchases, public.purchase_items to authenticated, service_role;`
  (sin grant de insert/update/delete — ni siquiera lo necesitan, la RPC con `security definer`
  no requiere que el rol `authenticated` tenga privilegio directo sobre la tabla).

## Funciones RPC e invariantes
- **`create_purchase(p_supplier_id uuid, p_status text, p_items jsonb, p_note text default
  null) returns uuid`** — `security definer`. Invariantes:
  1. Usuario autenticado y **admin del tenant** del `supplier_id` (`user_is_tenant_admin`); si
     no, rechaza.
  2. `supplier_id` pertenece al tenant del usuario (deriva `tenant_id` desde ahí) y está
     `active`.
  3. `p_status in ('draft', 'ordered')` — cualquier otro valor rechazado (no se crea
     directamente `received`/`cancelled`).
  4. `p_items` es un array JSON con **al menos 1 elemento**; cada elemento con `product_id`,
     `qty > 0`, `unit_cost ≥ 0`, `tax_rate` opcional (default 0); cada `product_id` pertenece
     al tenant y está `active`.
  5. `subtotal = Σ qty·unit_cost`, `tax = Σ qty·unit_cost·tax_rate/100`, `total = subtotal +
     tax` — calculados en la función, nunca recibidos del cliente.
  6. Si `p_status = 'ordered'`, `issued_at = now()`; si `'draft'`, `issued_at` queda `null`.
  7. Todo o nada: cualquier violación revierte la cabecera y los ítems ya insertados
     (transacción implícita de la función).
- **`mark_purchase_ordered(p_purchase_id uuid) returns void`** — `security definer`.
  Invariantes: usuario admin del tenant de la orden; la orden existe y está en `status =
  'draft'` (si ya es `ordered`/`received`/`cancelled`, rechaza — no hay transición hacia atrás
  ni duplicada); al aplicar, `status = 'ordered'` y `issued_at = now()`.

## Casos borde
- Orden sin ítems (`p_items = '[]'`) → rechazada, nada se inserta.
- Ítem con `qty ≤ 0` o `unit_cost < 0` → rechazado por el `check` de la tabla (y validado antes
  en la RPC para dar un mensaje claro en vez de un error crudo de constraint).
- `supplier_id` o algún `product_id` de otro tenant → rechazado (no hay fuga de existencia:
  mensaje genérico, sin distinguir "no existe" de "no es tuyo").
- Proveedor o producto archivado (`active = false`) → rechazado: no se puede comprar a/de algo
  inactivo.
- `mark_purchase_ordered` sobre una orden que ya no está en `draft` → rechazado con mensaje
  claro (idempotencia explícita: no "ordena" dos veces ni reabre una recibida/cancelada).
- Redondeo de `tax`: se calcula con la precisión de `numeric(14,2)` directamente en la suma,
  sin redondeos intermedios por ítem, para evitar arrastre de centavos.

## Consideraciones de seguridad (docs/arch/seguridad.md)
- Boundary de servidor (`createPurchase`/`markPurchaseOrdered`): Zod valida forma y tipos antes
  de invocar la RPC (`supplier_id` uuid, `status` enum, `items` array no vacío con tipos
  correctos) — la RPC es la frontera real de negocio, Zod evita mandar basura obviamente
  inválida.
- La app **nunca calcula ni envía** `subtotal`/`tax`/`total`: siempre los devuelve la RPC.
- Errores de Postgres (`P0001` de invariante, `42501` si alguna ruta de escritura directa se
  intentara) se mapean a mensajes genéricos en español — nunca se filtra el detalle interno.
- `tenant_id` nunca lo decide ni lo envía el cliente: la RPC lo deriva del `supplier_id`
  (que RLS ya acota a los tenants del usuario) y valida el rol admin explícitamente.

## Plan de tests
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1 | pgTAP | supabase/tests/S3-02-ordenes-compra.sql | `create_purchase` con 2 ítems → subtotal/tax/total exactos |
| 2 | pgTAP | supabase/tests/S3-02-ordenes-compra.sql | crear `ordered` fija `issued_at`; `mark_purchase_ordered` transiciona draft→ordered |
| 3 | pgTAP | supabase/tests/S3-02-ordenes-compra.sql | member no puede invocar ninguna RPC; sí ve el listado (select) |
| 4 | pgTAP | supabase/tests/S3-02-ordenes-compra.sql | sin ítems, qty≤0, proveedor/producto ajeno → rechazado y nada persiste |
| 5 | pgTAP | supabase/tests/S3-02-ordenes-compra.sql | aislamiento cruzado entre 2 tenants (select y RPC) |
| 1, 4 | Vitest | src/lib/validation/purchases.test.ts | schema Zod: ítems válidos/vacíos, qty/tax_rate fuera de rango |

## Historial
- 2026-07-20 · creada (draft) tras cerrar S3-01. Decisiones confirmadas con el humano: spec +
  implementación en la misma sesión; edición de ítems reservada explícitamente para S3-04 (no
  se solapa con esta historia); la RPC crea la orden eligiendo el estado inicial
  (`draft`/`ordered`) y una RPC aparte transiciona una `draft` existente a `ordered`.
- 2026-07-20 · aprobada (draft → approved) por el humano. Se implementa con TDD a
  continuación.
- 2026-07-20 · implementada (approved → implemented). TDD real: pgTAP
  (`supabase/tests/S3-02-ordenes-compra.sql`, 18 tests) y Vitest (`purchases.test.ts`, 9
  tests) escritos primero y verificados en rojo (`relation "public.purchases" does not
  exist` / `function public.create_purchase(...) does not exist`); migración
  `supabase/migrations/20260720090000_purchases.sql` después, en verde al primer intento
  (113/113 pgTAP: guardián + S1-01 + S1-03 + S1-05 + S2-01…S2-05 + S3-01 + S3-02; solo se
  ajustó el conteo del `plan()` del propio test, no la RPC). Tablas `purchases` +
  `purchase_items` con RLS de **solo lectura** (sin política de insert/update/delete): toda
  escritura entra por `create_purchase`/`mark_purchase_ordered` (`security definer`), que
  validan el rol admin explícitamente dentro de la función — mismo patrón que
  `register_movement` (S2-03), necesario porque `security definer` bypassa RLS. `create_purchase`
  calcula `subtotal`/`tax`/`total` iterando `p_items` (jsonb) dentro de la función, nunca en
  el cliente; rechaza proveedor/producto inactivo o de otro tenant, ítems vacíos y `qty≤0`,
  todo o nada. `mark_purchase_ordered` transiciona `draft`→`ordered` validando el estado
  actual. `src/actions/purchases.ts` (`createPurchase`/`markPurchaseOrdered`, columnas
  explícitas hacia la RPC, mapeo de mensajes de error por código interno a español genérico).
  `src/lib/validation/purchases.ts` (Zod: ítems con `qty`/`unit_cost`/`tax_rate` acotados,
  `items.min(1)`). UI `/(app)/compras/ordenes`: listado con embed PostgREST del proveedor
  (`select('*, suppliers(name)')`, sin N+1), `PurchaseForm` con líneas de ítems dinámicas
  (agregar/quitar en estado local, pre-llena costo/IVA desde `products_catalog` al elegir
  producto, total previsualizado en cliente solo como ayuda visual — la BD es la fuente de
  verdad), dos botones de envío (`status=draft`/`status=ordered`) vía `name="status"
  value="..."` en cada `<button type="submit">` (patrón nativo de HTML forms, sin JS
  adicional). `PurchaseRow` con acción "Marcar como ordenada" solo sobre `draft`. Enlace
  "Órdenes de compra" agregado a `/(app)/compras/page.tsx`.
  Verificado: lint ✓, tsc ✓, Vitest 80/80 ✓, `supabase test db` 113/113 ✓, tipos regenerados
  (`src/lib/database.types.ts`), y los 5 criterios de aceptación con navegador real vía
  script Playwright desechable (no commiteado — e2e formal sigue en S9-01): owner crea
  proveedor y 2 productos → crea una orden con 2 ítems como borrador → total exacto
  (388,00 = 2·100·1,19 + 3·50) visible en el listado, calculado por la RPC → la marca como
  ordenada → invita a un member (flujo S1-05) → member ve el listado sin formulario de crear
  ni botón de marcar ordenada → tenant nuevo no ve órdenes ajenas (aislamiento); 9 checks,
  todos en verde. Spec movida a `specs/done/`. BACKLOG S3-02 → `done`.
