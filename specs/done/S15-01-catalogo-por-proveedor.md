---
id: S15-01
titulo: Catálogo de productos por proveedor
estado: implemented            # draft → approved → implemented
depende_de: [S3-01, S3-02, S3-03]
---

# S15-01 — Catálogo de productos por proveedor

## Contexto y valor
Al armar una orden de compra, el selector de producto (`compras/ordenes/purchase-form.tsx`)
muestra el catálogo entero sin importar el proveedor elegido — el comprador recorre todos los
productos para encontrar los que realmente le compra a ese proveedor. Se introduce una relación
proveedor↔producto que se sugiere primero en el formulario, sin bloquear nunca la orden.

## Alcance
- Tabla `supplier_products` (relación proveedor↔producto), con RLS y test de aislamiento.
- `receive_purchase` alimenta la relación automáticamente al recibir una compra (upsert, dentro
  de la misma transacción atómica que ya existe).
- Gestión manual de la relación desde una página nueva bajo `/compras/proveedores/[id]/productos`
  (alta y baja), visible para owner/admin.
- En `/compras/ordenes`, el selector de producto agrupa "sugeridos para este proveedor" arriba y
  "todo el catálogo" desplegable debajo, una vez elegido el proveedor.

## NO-alcance (explícito)
- Filtrar/bloquear el selector a solo los productos del proveedor: el catálogo completo sigue
  siempre accesible, con o sin asociación.
- Costo específico por proveedor, SKU del proveedor, cantidad mínima de pedido: el autocompletado
  de costo sigue viniendo de `products_catalog` (campo `cost` del producto), sin campo propio.
- Recepción parcial de una orden (no existe hoy en el modelo; se anota como caso a revisar si se
  introduce en el futuro — ver Casos borde).
- Reordenar/editar el antipatrón `<td colSpan>` de `supplier-row.tsx` — se añade un link nuevo sin
  tocar esa estructura.
- S15-02 (alta rápida de cliente en el POS): historia separada de la misma épica.

## Criterios de aceptación
1. **Dado** un tenant con productos ya asociados a un proveedor (por recepción previa o alta
   manual), **cuando** el comprador elige ese proveedor en el formulario de orden, **entonces**
   el selector de producto muestra primero un grupo "Sugeridos" con esos productos.
2. **Dado** el grupo de sugeridos visible, **cuando** el comprador pulsa "Ver todo el catálogo",
   **entonces** aparece también el resto de productos activos, sin duplicar los ya sugeridos ni
   perder ninguno del catálogo.
3. **Dado** un proveedor sin productos asociados, **cuando** se elige en el formulario,
   **entonces** el selector muestra el catálogo completo directamente (sin grupo vacío) — nunca
   bloquea crear la orden.
4. **Dado** un `member`, `admin` u `owner` con una orden en estado `ordered`, **cuando** recibe la
   orden (`receive_purchase`), **entonces** cada producto de esa orden queda asociado al
   proveedor de la orden en `supplier_products` (si no lo estaba ya), sin duplicar filas aunque
   el mismo producto aparezca en más de un ítem de la orden.
5. **Dado** un `owner`/`admin` en la ficha `/compras/proveedores/[id]/productos`, **cuando**
   asocia o quita manualmente un producto, **entonces** el cambio se refleja ahí y en el próximo
   formulario de orden de ese proveedor; un `member` ve la lista de solo lectura, sin controles de
   alta/baja. En viewport 375px la página no produce scroll horizontal.

## Modelo de datos y migraciones
Referencia: `docs/data-model.md` sección "Compras (E3)".

Migración 1 (`supplier-products`):
```sql
create table public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  supplier_id uuid not null,
  product_id uuid not null,
  last_purchased_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (supplier_id, product_id),
  foreign key (supplier_id, tenant_id) references public.suppliers (id, tenant_id) on delete cascade,
  foreign key (product_id, tenant_id) references public.products (id, tenant_id) on delete cascade
);
create index supplier_products_tenant_id_idx on public.supplier_products (tenant_id);
create index supplier_products_product_id_idx on public.supplier_products (product_id);
```
Requiere `unique (id, tenant_id)` nuevo (aditivo) sobre `suppliers` y `products` para poder
declarar las FKs compuestas — no toca las migraciones que crearon esas tablas.

Sin soft-delete (`active`): es una relación sin historial propio y ninguna otra tabla la
referencia, así que el borrado es físico (`DELETE`).

Migración 2 (`receive-purchase-supplier-products`): `create or replace function
public.receive_purchase(uuid, uuid)` — mismo cuerpo y firma que
`20260720143947_receive-purchase.sql` (nunca se edita ese archivo), añadiendo:
- `select ... supplier_id into ... v_supplier_id` en la resolución inicial de la orden.
- Tras el loop de `register_movement`, antes de marcar `received`:
```sql
insert into public.supplier_products (tenant_id, supplier_id, product_id, last_purchased_at)
select distinct v_tenant_id, v_supplier_id, pi.product_id, now()
from public.purchase_items pi
where pi.purchase_id = p_purchase_id
on conflict (supplier_id, product_id)
  do update set last_purchased_at = excluded.last_purchased_at;
```

## Políticas RLS requeridas
`supplier_products` (patrón de `docs/arch/multitenancy-rls.md` + matriz de
`docs/arch/permisos-roles.md`, fila nueva: "Asociar producto↔proveedor manualmente" ✔ owner/admin,
✖ member — la asociación automática al recibir no pasa por esta política, ver abajo):
- `select`: todo el tenant (`tenant_id in (select user_tenant_ids())`) — el comprador `member`
  necesita ver las sugerencias.
- `insert`/`delete`: `user_is_tenant_admin(tenant_id)`.
- Sin `update` ni política ni grant: el único `UPDATE` (`last_purchased_at`) lo hace
  `receive_purchase`, `security definer`, que bypasa RLS igual que ya hace con
  `stock_movements`/`purchase_items` — así un `member` que recibe la compra sí alimenta el
  catálogo aunque no pueda escribir la tabla directo por PostgREST.

## Funciones RPC e invariantes
`receive_purchase(p_purchase_id uuid, p_warehouse_id uuid)` — invariantes ya existentes intactas
(orden `ordered`→`received`, un `stock_movement` por ítem, atomicidad, `permission_denied` fuera
de tenant) más la nueva: el upsert a `supplier_products` es parte de la misma transacción — si
algo falla, no quedan filas huérfanas.

`linkSupplierProduct`/`unlinkSupplierProduct` son Server Actions con `insert`/`delete` directos
(sin RPC): un solo statement, sin invariante transaccional que proteger (regla innegociable #2 no
aplica — precedente: `src/actions/suppliers.ts`).

## Casos borde
- Producto repetido en dos ítems de la misma orden → `select distinct` evita el error `21000` del
  `on conflict`; test pgTAP dedicado.
- Producto o proveedor archivado (`active=false`) con relación existente: la fila no se borra (el
  selector de orden ya filtra por `active=true` aguas arriba, así que desaparece solo de las
  sugerencias); en la página de gestión se muestra tachado, con opción de quitar.
- Recepción parcial de una orden: no existe hoy (`receive_purchase` recibe todo o nada); si se
  introduce en una historia futura, el upsert deberá moverse a solo los ítems recibidos —
  anotado como comentario en la migración.
- Asociación manual duplicada o ya creada por recepción previa: `on conflict`/`23505` mapeado a
  mensaje amable, sin romper el flujo.
- `member` intenta asociar/quitar vía POST directo (bypaseando la UI): RLS lo rechaza (`42501`).

## Consideraciones de seguridad (docs/arch/seguridad.md)
- Boundary de servidor: `linkSupplierProduct`/`unlinkSupplierProduct` validan `supplier_id`/
  `product_id` con Zod (`z.uuid()`), `tenant_id` se resuelve en servidor vía `getActiveTenant()`
  (nunca del cliente), insert con columnas explícitas.
- Errores internos (`error.code` de Postgres) se loguean en servidor y se traducen a mensaje
  genérico antes de llegar al cliente — nunca se expone el código crudo.
- RLS es la frontera real; la UI (ocultar botones a `member`) es solo experiencia, no seguridad.

## Plan de tests (qué test cubre qué criterio)
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 4, seguridad | pgTAP | `supabase/tests/S15-01-supplier-products.sql` | aislamiento por tenant (select/insert cross-tenant rechazados), `member` no inserta/borra, owner/admin sí, FK compuesta rechaza producto de otro tenant |
| 1, 3, 4 | pgTAP | `supabase/tests/S15-01-receive-purchase-upsert.sql` | recepción crea filas nuevas; producto repetido en la misma orden no duplica ni falla (`21000`); recepción posterior actualiza `last_purchased_at` sin duplicar; atomicidad si la RPC falla por otro motivo |
| — | pgTAP (regresión) | `S3-03-receive-purchase.sql`, `S3-04-cancelacion-compra.sql` | siguen verdes sin editarlos |
| 5 | Vitest | `src/actions/supplier-products.test.ts` | columnas explícitas, Zod rechaza uuid inválido, `23505`/`23503` mapeados, `revalidatePath` en ambas rutas |
| 1, 2, 3 | Vitest | `src/app/(app)/compras/ordenes/product-options.test.ts` | sin proveedor o sin sugeridos → lista completa; con sugeridos → agrupado sin duplicar; `keepIds` siempre presentes |
| 5 | manual | — | 375px sin scroll horizontal en `/compras/proveedores/[id]/productos`, claro y oscuro |

## Historial
- 2026-08-16 · creada (draft)
- 2026-08-16 · approved
- 2026-08-16 · implemented
