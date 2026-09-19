---
id: S2-02
titulo: Gestión de productos
estado: implemented
depende_de: [S2-01]
---

# S2-02 — Productos

## Contexto y valor
Segunda historia de E2 (Inventario). Con `warehouses` ya `done` (S2-01), el sistema necesita
un catálogo de **productos** antes de poder registrar movimientos de stock (S2-03), compras
(S3-02), ventas (S5-02) o recetas de producción (S6-01) — todos referenciarán `product_id`. Un
admin necesita catalogar materias primas/insumos, terminados propios y productos de reventa con
sus datos comerciales (SKU, costo, precio, IVA, stock mínimo) desde el día uno.

## Alcance
- Tabla `products` (catálogo simple, sin lógica transaccional — el stock y el costo promedio
  reales **no se guardan aquí**: se derivan de `stock_movements` en S2-03/S2-04; `cost`/`price`
  son valores referenciales/iniciales que el usuario captura).
- CRUD desde `/(app)/inventario/productos`: crear, editar todos los campos, archivar/reactivar
  (soft-delete vía `active` — nunca `DELETE` físico, mismo motivo que `warehouses`:
  `stock_movements` referenciará `product_id`).
- Enlace "Productos" dentro del módulo Inventario (junto a "Bodegas").
- Listado (SKU, nombre, tipo, estado) visible a **todos los roles**; crear/editar/archivar
  restringido a **owner/admin** (matriz `permisos-roles.md`: "Gestionar catálogos" ✖ member).
- **`cost`, `price`, `tax_rate` visibles solo a owner/admin** (matriz `permisos-roles.md`: "Ver
  costos y márgenes de producto" ✖ member) — a diferencia de bodegas, aquí sí hay columnas
  sensibles. Mecanismo elegido (decisión confirmada con el humano, ver sección RLS): vista
  `products_catalog` con esas 3 columnas enmascaradas a `null` para member, más restricción de
  columna en la tabla base para que ni siquiera una consulta directa a `products` las exponga.
- SKU **obligatorio y único por tenant** (decisión confirmada con el humano).

## NO-alcance (explícito)
- Movimientos de stock, vistas de stock/kardex, alertas de mínimo (S2-03/04/05).
- Recetas (`recipe_items`, S6-01).
- Borrado físico de productos (soft-delete permanente por diseño).
- Conversión de unidades y adjuntos/fotos (Fase 2, según `data-model.md`).
- El stock actual y el costo promedio ponderado real (ADR-012) — llegan con S2-03/S2-04.

## Criterios de aceptación
1. **Dado** un owner/admin **cuando** crea un producto con SKU y nombre válidos **entonces**
   queda registrado con `active = true` y aparece en el listado.
2. **Dado** un `member` **cuando** intenta crear/editar/archivar un producto **entonces** la
   operación es rechazada por RLS (probado en pgTAP); el `member` sí puede **ver** el listado
   (SKU, nombre, tipo, stock mínimo, estado) pero **no** ve `cost`/`price`/`tax_rate` (llegan
   como `null` vía la vista; una consulta directa a la tabla base para esas columnas es
   rechazada por falta de privilegio de columna).
3. **Dado** un owner/admin **cuando** edita los campos de un producto existente de su tenant
   **entonces** el cambio se refleja y `updated_at` se actualiza (trigger compartido).
4. **Dado** un owner/admin **cuando** archiva un producto (`active = false`) **entonces** deja
   de ofrecerse como destino en formularios futuros (S2-03) pero no se borra ni pierde su
   historial; puede reactivarlo después.
5. **Dado** dos tenants con productos propios **cuando** cualquier usuario consulta el listado
   **entonces** solo ve los productos de su(s) tenant(s) (aislamiento probado en pgTAP); y un
   SKU puede repetirse entre tenants distintos pero **no** dentro del mismo tenant (violación
   → error de unicidad, mapeado a mensaje amigable).

## Modelo de datos y migraciones
Según `docs/data-model.md` (Inventario), tabla nueva `products`:

```sql
create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  sku text not null,
  name text not null,
  description text,
  unit text not null default 'unidad',
  kind text not null default 'raw' check (kind in ('raw', 'finished', 'resale')),
  cost numeric(14,2) not null default 0,
  price numeric(14,2) not null default 0,
  tax_rate numeric(5,2) not null default 19,
  min_stock numeric(14,3) not null default 0,
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, sku)
);

create index products_tenant_id_idx on public.products (tenant_id);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();
```

Todo en una sola migración (tabla + RLS + `FORCE ROW LEVEL SECURITY` + vista de columnas
enmascaradas + GRANTs + índice + trigger), forward-only.

## Políticas RLS requeridas
Según matriz `docs/arch/permisos-roles.md` y patrón `docs/arch/multitenancy-rls.md`. Dos
capas: **aislamiento por tenant + rol** (igual que `warehouses`) y **enmascarado de columnas
sensibles** (nuevo en E2, primera tabla con costos).

**Aislamiento (igual patrón que `warehouses`):**
- `products_tenant_select` — `for select using (tenant_id in (select user_tenant_ids()))`:
  visible a todo el equipo del tenant (owner/admin/member), a nivel de fila.
- `products_admin_write` (insert) y `products_admin_update` (update) —
  `with check/using (user_is_tenant_admin(tenant_id))`: solo owner/admin escriben. Sin política
  de delete (soft-delete vía `active`).

**Enmascarado de costos (nuevo — decisión de esta spec):**
Postgres no soporta RLS a nivel de columna condicionada por rol de membresía (el `GRANT`
columnar es por rol de Postgres —`authenticated`—, no por fila/tenant). Mecanismo elegido:
1. Vista `public.products_catalog` (sin `security_invoker`, corre con los privilegios del
   dueño de la tabla — puede leer `cost`/`price`/`tax_rate` sin necesitar el `GRANT` columnar
   directo), que expone todas las columnas pero enmascara las 3 sensibles a `null` cuando
   quien consulta no es owner/admin del tenant de la fila (`user_is_tenant_admin(tenant_id)`,
   evaluado con el `auth.uid()` real de la sesión invocadora — independiente del modo
   definer/invoker de la vista).
2. **Hallazgo de verificación manual (corrige el diseño inicial de esta spec)**: se intentó
   primero `alter table products force row level security` para que el aislamiento por tenant
   se seguiera aplicando aunque la vista corriera como dueño de la tabla. No funcionó: en
   Supabase el dueño de la tabla (`postgres`) tiene el atributo `rolbypassrls`, que **gana
   sobre `FORCE`** — confirmado con `select rolbypassrls from pg_roles where rolname =
   'postgres'` (`true`). El resultado era una vista que devolvía filas de **todos los
   tenants** a cualquier usuario, detectado con el script Playwright de verificación manual (no
   por pgTAP — se sumó cobertura pgTAP para este caso específico, ver Plan de tests). Mecanismo
   corregido: el aislamiento por tenant se repite **explícitamente** en el `where` de la vista
   (`where tenant_id in (select user_tenant_ids())`), sin depender de que Postgres aplique la
   política de la tabla automáticamente a través de la vista.
3. La tabla base `products` **no otorga `SELECT`** de las columnas `cost`, `price`, `tax_rate`
   a `authenticated` (`GRANT SELECT (columnas no sensibles) ON products TO authenticated`): una
   consulta directa a la tabla pidiendo esas columnas falla con "permission denied", sin
   depender de que la app use la vista correctamente. `INSERT`/`UPDATE` sí incluyen esas
   columnas (`grant insert, update on products to authenticated`) porque el owner/admin las
   necesita para crear/editar — la fila igual queda protegida por `products_admin_write/update`.
4. `grant select on public.products_catalog to authenticated, service_role;`

La página de listado consulta **siempre** `products_catalog` (nunca `products` directo) para
lectura; las Server Actions de escritura (`createProduct`/`updateProduct`) escriben en
`products` directamente (columnas explícitas, RLS de escritura ya restringe a admin).

## Funciones RPC e invariantes
N/A — CRUD de catálogo sin invariante transaccional (no hay stock que cuadrar; eso llega con
`register_movement` en S2-03). Escritura directa vía `supabase-js` `.insert()/.update()` con
columnas explícitas, protegida por RLS. Único invariante de datos es la unicidad de
`(tenant_id, sku)`, garantizada por el índice único de la tabla (Postgres, no una RPC).

## Casos borde
- SKU o nombre vacíos/solo espacios → rechazados por Zod antes de llegar a Postgres.
- SKU duplicado dentro del mismo tenant → violación `23505` de Postgres, mapeada a mensaje
  "Ya existe un producto con ese SKU."; el mismo SKU en un tenant distinto se inserta sin error.
- `cost`/`price`/`min_stock` negativos, o `tax_rate` fuera de 0–100 → rechazados por Zod.
- Archivar un producto ya archivado → operación idempotente.
- Un tenant con cero productos → empty state con acción "Crear producto".
- `member` que fuerza la URL de edición/archivado → RLS rechaza la escritura; UI ya no le
  muestra los controles. `member` que intenta leer `cost`/`price` directo de `products` (p. ej.
  vía REST) → rechazado por falta de privilegio de columna, no solo ocultado en UI.

## Consideraciones de seguridad (docs/arch/seguridad.md)
- Boundary de servidor (Server Actions `createProduct`/`updateProduct`/`toggleProductActive`):
  Zod valida todos los campos (tipos, rangos, longitud) antes de cualquier operación.
- Inserts/updates con columnas explícitas — nunca spread del input del cliente.
- `tenant_id` se resuelve en servidor vía `getActiveTenant()`; el cliente nunca lo envía.
- Errores de Postgres (RLS `42501`, unicidad `23505`) se mapean a mensajes genéricos/amigables
  en español — nunca se filtra el código/detalle interno al cliente.
- Columnas sensibles (`cost`/`price`/`tax_rate`) protegidas en la capa de datos (vista +
  restricción de `GRANT` columnar), no solo ocultas en la UI — cumple el principio de
  `permisos-roles.md` de que la BD es la frontera real también para datos sensibles, no
  únicamente para filas.

## Plan de tests
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 3 | pgTAP | supabase/tests/S2-02-productos.sql | owner/admin crean y editan; `updated_at` cambia |
| 2 | pgTAP | supabase/tests/S2-02-productos.sql | member ve el listado (vía vista) pero no puede insert/update/archivar; cost/price/tax_rate llegan `null` a member vía la vista y con error de permiso vía la tabla base |
| 4 | pgTAP | supabase/tests/S2-02-productos.sql | archivar/reactivar (`active` toggle), sin borrado físico |
| 5 | pgTAP | supabase/tests/S2-02-productos.sql | aislamiento cruzado entre 2 tenants (select y write); SKU único por tenant (`23505`) y repetible entre tenants |
| 1 | Vitest | src/lib/validation/products.test.ts | schema Zod: sku/nombre válidos/vacíos/longitud, kind enum, cost/price/min_stock no negativos, tax_rate en rango |

## Historial
- 2026-07-20 · creada (draft) como segunda historia de Sprint 2, tras cerrar S2-01. Durante la
  redacción se identificó un requisito de `docs/arch/permisos-roles.md` no cubierto por el
  patrón de bodegas (member no debe ver costos/precios) y se confirmó con el humano el
  mecanismo: vista `products_catalog` con columnas enmascaradas + `FORCE ROW LEVEL SECURITY` +
  restricción de `GRANT` columnar en la tabla base, en vez de solo ocultar en la UI.
- 2026-07-20 · aprobada (draft → approved) por el humano junto con el plan de sesión (alcance,
  SKU único obligatorio, UI con formulario dedicado y mecanismo de enmascarado de columnas
  confirmados en esta misma sesión). Se implementa con TDD a continuación.
- 2026-07-20 · implementada (approved → implemented). TDD real: Vitest
  (`products.test.ts`, 17 tests) y pgTAP (`S2-02-productos.sql`, 16 tests) escritos primero y
  verificados en rojo (import fallido / `relation "public.products" does not exist`); migración
  `products` después, en verde (57/57 pgTAP con guardián + S1-01 + S1-03 + S1-05 + S2-01 +
  S2-02) — tabla `products`, RLS espejo de `warehouses` (select amplio al tenant, write solo
  `user_is_tenant_admin`), `unique(tenant_id, sku)`, vista `products_catalog` con
  `cost`/`price`/`tax_rate` enmascarados a `null` para member, `GRANT` columnar restringido en
  la tabla base para esas 3 columnas.
  **Hallazgo crítico de seguridad durante la verificación manual (no detectado por pgTAP en su
  primera versión)**: el diseño inicial de la vista usaba `alter table products force row level
  security` asumiendo que forzaría el aislamiento por tenant también para la vista (que corre
  con los privilegios del dueño de la tabla). No funcionó — el script Playwright de
  verificación mostró un tenant nuevo viendo productos de otro tenant a través de
  `products_catalog`. Causa raíz confirmada con `select rolbypassrls from pg_roles where
  rolname = 'postgres'` → `true`: en Supabase el dueño de las tablas tiene `rolbypassrls`, que
  **ignora `FORCE ROW LEVEL SECURITY`** (el bypass por rol gana). Corregido moviendo el
  aislamiento a un `where tenant_id in (select user_tenant_ids())` **explícito** dentro de la
  vista, sin depender de que Postgres aplique la política de la tabla automáticamente a través
  de ella; se sumó un test pgTAP dedicado a esta regresión (`S2-02-productos.sql`, ver plan de
  tests). **Anotado como lección reutilizable para `supabase-miel`**: cualquier vista `security
  invoker = false` (o función `security definer`) sobre una tabla con RLS en Supabase debe
  replicar el filtro de tenant explícitamente en su propia definición — `FORCE ROW LEVEL
  SECURITY` no protege contra el dueño de la tabla en este proyecto.
  `src/actions/products.ts` (`createProduct`/`updateProduct`/`toggleProductActive`, columnas
  explícitas, `getActiveTenant()`, `23505` mapeado a "Ya existe un producto con ese SKU."),
  `src/lib/validation/products.ts` (Zod, `z.coerce.number()` para campos numéricos de
  `FormData`). UI en `/(app)/inventario/productos`: listado en tabla (SKU, nombre, tipo,
  precio, stock mínimo), `ProductForm` reutilizable para crear y editar (formulario dedicado
  con todos los campos, decisión confirmada con el humano — no edición inline por la cantidad
  de campos), `ProductRow` con edición expandida por fila y archivar/reactivar, gating de
  controles por `active.role !== "member"`. Enlace "Productos" agregado a `/(app)/inventario`.
  Verificado: lint ✓, tsc ✓, Vitest 58/58 ✓, `supabase test db` 57/57 ✓, tipos regenerados
  (`src/lib/database.types.ts`), y los 5 criterios de aceptación con navegador real vía script
  Playwright desechable (no commiteado — e2e formal sigue en S9-01): owner crea producto → SKU
  duplicado rechazado con mensaje → edita nombre → archiva y reactiva → invita a un member
  (flujo S1-05: signup con `next` → aceptar invitación) → member ve el listado sin botón
  Editar y con precio oculto (`—`) → tenant nuevo no ve productos ajenos (aislamiento,
  incluyendo el caso corregido arriba); 10 checks. Spec movida a `specs/done/`. BACKLOG S2-02
  → `done`.
