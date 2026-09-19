---
id: S3-01
titulo: Gestión de proveedores
estado: implemented
depende_de: [S1-04]
---

# S3-01 — Proveedores

## Contexto y valor
Todo el módulo de Compras (E3) necesita proveedores: las órdenes de compra (S3-02)
referenciarán `supplier_id`. Un admin necesita poder registrar a quién le compra (con NIT
para trazabilidad fiscal) desde el día uno. Primera historia de E3 — Sprint 3, arranca tras
cerrar Sprint 2 (Inventario).

## Alcance
- Tabla `suppliers` (catálogo simple, sin lógica transaccional).
- CRUD desde `/(app)/compras/proveedores`: crear, editar, archivar/reactivar (soft-delete vía
  `active` — nunca `DELETE` físico, porque `purchases` (S3-02) referenciará `supplier_id` y
  borrar en duro rompería el historial de compras).
- Campos: `name` (requerido), `nit`, `email`, `phone`, `address` (todos opcionales).
- NIT único por tenant **cuando está presente** (índice único parcial `where nit is not null`
  — evita proveedores duplicados sin obligar a digitarlo desde el primer registro).
- Enlace "Proveedores" dentro del módulo Compras (hoy `ModulePlaceholder` puro en
  `src/app/(app)/compras/page.tsx`).
- Listado visible a **todos los roles** (owner/admin/member); crear/editar/archivar
  restringido a **owner/admin** (matriz `permisos-roles.md`: "Gestionar catálogos (products,
  warehouses, suppliers…)" ✖ member).

## NO-alcance (explícito)
- Órdenes de compra (`purchases`/`purchase_items`, S3-02), recepción (S3-03), cancelación
  (S3-04).
- Pagos a proveedores y cuentas por pagar (E4).
- Validación de dígito de verificación o formato estricto del NIT (texto libre; facturación
  electrónica DIAN es Fase 2 — el campo existe desde ya para no cerrar esa puerta).
- Borrado físico de proveedores (soft-delete permanente por diseño; sin papelera ni purge).

## Criterios de aceptación
1. **Dado** un owner/admin **cuando** crea un proveedor con nombre válido (NIT opcional)
   **entonces** queda registrado con `active = true` y aparece en el listado.
2. **Dado** un owner/admin **cuando** intenta crear un segundo proveedor con el mismo NIT en
   su tenant **entonces** la operación es rechazada con un mensaje claro ("Ya existe un
   proveedor con ese NIT."); dos proveedores sin NIT (NULL) conviven sin conflicto.
3. **Dado** un `member` **cuando** intenta crear/editar/archivar un proveedor **entonces** la
   operación es rechazada por RLS (probado en pgTAP); el `member` sí puede **ver** el listado.
4. **Dado** un owner/admin **cuando** edita los datos de un proveedor existente de su tenant
   **entonces** el cambio se refleja y `updated_at` se actualiza (trigger compartido).
5. **Dado** un owner/admin **cuando** archiva un proveedor (`active = false`) **entonces**
   deja de ofrecerse como destino en formularios futuros (S3-02) pero no se borra ni pierde
   su historial; puede reactivarlo después.
6. **Dado** dos tenants con proveedores propios **cuando** cualquier usuario consulta el
   listado **entonces** solo ve los proveedores de su(s) tenant(s) (aislamiento probado en
   pgTAP).

## Modelo de datos y migraciones
Según `docs/data-model.md` (Compras), tabla nueva `suppliers`:

```sql
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  name text not null,
  nit text,
  email text,
  phone text,
  address text,
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index suppliers_tenant_id_idx on public.suppliers (tenant_id);

-- NIT único por tenant solo cuando está presente (permite múltiples proveedores sin NIT).
create unique index suppliers_tenant_nit_key
  on public.suppliers (tenant_id, nit) where nit is not null;

-- Trigger compartido, ya existe desde la migración base (S1-01): set_updated_at()
create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();
```

Todo en una sola migración (RLS + políticas + índices + trigger + GRANT), forward-only.

## Políticas RLS requeridas
Según matriz `docs/arch/permisos-roles.md` y patrón `docs/arch/multitenancy-rls.md`:
- `suppliers_tenant_select` — `for select using (tenant_id in (select user_tenant_ids()))`:
  visible a **todo el equipo** del tenant (owner/admin/member).
- `suppliers_admin_write` (insert) + `suppliers_admin_update` (update), ambas
  `using/with check (user_is_tenant_admin(tenant_id))`: solo owner/admin escriben. Sin
  política de delete (soft-delete vía `active`) — mismo patrón que `warehouses` (S2-01) y
  `products` (S2-02).
- `grant select, insert, update on public.suppliers to authenticated, service_role;` (todas
  las columnas — no hay campos sensibles por rol aquí, a diferencia de `products`).

## Funciones RPC e invariantes
N/A — CRUD de catálogo sin invariante transaccional (no hay stock ni saldo que cuadrar; eso
llega con `receive_purchase` en S3-03). Escritura directa vía `supabase-js`
`.insert()/.update()` con columnas explícitas, protegida por RLS.

## Casos borde
- Nombre vacío o solo espacios → rechazado por Zod antes de llegar a Postgres.
- NIT duplicado en el mismo tenant → rechazado por el índice único parcial (`23505`),
  mapeado a mensaje amigable en la Server Action.
- Dos proveedores sin NIT (campo vacío → `null`) → conviven sin conflicto (índice parcial
  excluye `NULL`).
- Archivar un proveedor ya archivado → operación idempotente (vuelve a poner
  `active = false`, sin error).
- Un tenant con cero proveedores → empty state con acción "Crear proveedor" (no tabla vacía
  muda).
- `member` que fuerza la URL de edición/archivado → RLS rechaza la escritura; UI ya no le
  muestra los controles (oculta con gating por rol, igual que `/inventario/bodegas`).

## Consideraciones de seguridad (docs/arch/seguridad.md)
- Boundary de servidor (Server Action `createSupplier`/`updateSupplier`/
  `toggleSupplierActive`): Zod valida `name` (string, trim, 1–120, requerido) y
  `nit`/`email`/`phone`/`address` (opcionales, trim; `email` valida formato solo si no está
  vacío) antes de cualquier operación.
- Inserts/updates con columnas explícitas — nunca spread del input del cliente.
- `tenant_id` se resuelve en servidor vía `getActiveTenant()` (S1-04); el cliente nunca lo
  envía ni lo decide.
- Errores de Postgres (`23505` NIT duplicado, `42501` RLS si un `member` fuerza la mutación)
  se mapean a un mensaje genérico en español — nunca se filtra el código/detalle interno al
  cliente.
- RLS es la frontera real: la UI oculta los controles de escritura a `member` como
  experiencia, no como seguridad.

## Plan de tests
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 4 | pgTAP | supabase/tests/S3-01-proveedores.sql | owner/admin crean y editan; `updated_at` cambia |
| 2 | pgTAP | supabase/tests/S3-01-proveedores.sql | NIT duplicado en tenant rechazado; 2 NIT NULL conviven |
| 3 | pgTAP | supabase/tests/S3-01-proveedores.sql | member ve pero no puede insert/update/archivar (RLS) |
| 5 | pgTAP | supabase/tests/S3-01-proveedores.sql | archivar/reactivar (`active` toggle), sin borrado físico |
| 6 | pgTAP | supabase/tests/S3-01-proveedores.sql | aislamiento cruzado entre 2 tenants (select y write) |
| 1, 2 | Vitest | src/lib/validation/suppliers.test.ts | schema Zod: nombre válido/vacío/largo, email inválido |

## Historial
- 2026-07-20 · creada (draft) al arrancar Sprint 3 (E3 — Compras), primera historia tras
  cerrar Sprint 2. Decisiones confirmadas con el humano: spec + implementación en la misma
  sesión; NIT único por tenant solo si está presente (índice parcial); soft-delete vía
  `active` (no `DELETE` físico, por el historial que construirá `purchases` en S3-02) —
  mismo patrón de diseño que `warehouses` (S2-01).
- 2026-07-20 · aprobada (draft → approved) por el humano. Se implementa con TDD a
  continuación.
- 2026-07-20 · implementada (approved → implemented). TDD real: pgTAP
  (`supabase/tests/S3-01-proveedores.sql`, 13 tests) y Vitest (`suppliers.test.ts`, 9 tests)
  escritos primero y verificados en rojo (`relation "public.suppliers" does not exist`);
  migración `suppliers` después, en verde (95/95 pgTAP: guardián + S1-01 + S1-03 + S1-05 +
  S2-01…S2-05 + S3-01). RLS espejo de `warehouses`/`products` (select amplia para todo el
  tenant, insert/update restringidos a `user_is_tenant_admin`, sin política de delete —
  soft-delete vía `active`), sin vista de enmascarado (no hay columnas sensibles por rol en
  `suppliers`). Índice único parcial `suppliers_tenant_nit_key` (`tenant_id, nit` where `nit
  is not null`) — NIT único por tenant solo cuando está presente, confirmado con el humano.
  `src/actions/suppliers.ts` (`createSupplier`/`updateSupplier`/`toggleSupplierActive`,
  columnas explícitas, `getActiveTenant()`, `23505` → "Ya existe un proveedor con ese NIT.").
  `src/lib/validation/suppliers.ts` (Zod: `name` requerido; `nit`/`email`/`phone`/`address`
  opcionales; `email` valida formato solo si no está vacío). UI en
  `/(app)/compras/proveedores`: listado en tabla (nombre, NIT, email, teléfono),
  `SupplierForm` reutilizable (crear/editar, espejo de `ProductForm`), `SupplierRow` con
  edición expandida por fila y archivar/reactivar, gating de controles por
  `active.role !== "member"`. `src/app/(app)/compras/page.tsx` pasó de `ModulePlaceholder`
  puro a una landing mínima con enlace "Proveedores" (mismo patrón que tuvo `/inventario`
  tras S2-01, antes de evolucionar en S2-04).
  Verificado: lint ✓, tsc ✓, Vitest 71/71 ✓, `supabase test db` 95/95 ✓, tipos regenerados
  (`src/lib/database.types.ts`), y los 6 criterios de aceptación con navegador real vía
  script Playwright desechable (no commiteado — e2e formal sigue en S9-01): owner crea
  proveedor → NIT duplicado rechazado con mensaje claro → edita (email) → archiva → reactiva
  → invita a un member (flujo S1-05: signup con `next` → aceptar invitación) → member ve el
  listado sin formulario de crear ni botón Editar → tenant nuevo no ve proveedores ajenos
  (aislamiento); 11 checks. Spec movida a `specs/done/`. BACKLOG S3-01 → `done`.
