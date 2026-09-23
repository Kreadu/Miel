---
id: S2-01
titulo: Gestión de bodegas
estado: implemented
depende_de: [S1-04]
---

# S2-01 — Bodegas

## Contexto y valor
Todo el módulo de Inventario (E2) necesita bodegas: `products` (S2-02) y
`stock_movements` (S2-03) referenciarán `warehouse_id`. Un admin necesita poder organizar su
inventario en una o varias bodegas físicas (local, depósito, sucursal) desde el día uno.
Primera historia de E2 — Sprint 2.

## Alcance
- Tabla `warehouses` (catálogo simple, sin lógica transaccional).
- CRUD desde `/(app)/inventario/bodegas`: crear, editar nombre, archivar/reactivar
  (soft-delete vía `active` — nunca `DELETE` físico, porque `stock_movements` (S2-03)
  referenciará `warehouse_id` y borrar en duro rompería el kardex histórico).
- Enlace "Bodegas" dentro del módulo Inventario (hoy `ModulePlaceholder`).
- Listado visible a **todos los roles** (owner/admin/member); crear/editar/archivar
  restringido a **owner/admin** (matriz `permisos-roles.md`: "Ver inventario" ✔ todos,
  "Gestionar catálogos" ✖ member).

## NO-alcance (explícito)
- Productos (`products`, S2-02), movimientos de stock (S2-03), vistas de stock/kardex
  (S2-04), alertas de mínimo (S2-05).
- Borrado físico de bodegas (soft-delete permanente por diseño; sin papelera ni purge).
- Transferencias entre bodegas o cualquier lógica que dependa de `stock_movements`
  (no existe aún).

## Criterios de aceptación
1. **Dado** un owner/admin **cuando** crea una bodega con nombre válido **entonces** queda
   registrada con `active = true` y aparece en el listado.
2. **Dado** un `member` **cuando** intenta crear/editar/archivar una bodega **entonces** la
   operación es rechazada por RLS (probado en pgTAP); el `member` sí puede **ver** el listado.
3. **Dado** un owner/admin **cuando** edita el nombre de una bodega existente de su tenant
   **entonces** el cambio se refleja y `updated_at` se actualiza (trigger compartido).
4. **Dado** un owner/admin **cuando** archiva una bodega (`active = false`) **entonces** deja
   de ofrecerse como destino en formularios futuros (S2-02/S2-03) pero no se borra ni pierde
   su historial; puede reactivarla después.
5. **Dado** dos tenants con bodegas propias **cuando** cualquier usuario consulta el listado
   **entonces** solo ve las bodegas de su(s) tenant(s) (aislamiento probado en pgTAP).

## Modelo de datos y migraciones
Según `docs/data-model.md` (Inventario), tabla nueva `warehouses`:

```sql
create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  name text not null,
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index warehouses_tenant_id_idx on public.warehouses (tenant_id);

-- Trigger compartido, ya existe desde la migración base (S1-01): set_updated_at()
create trigger warehouses_set_updated_at
  before update on public.warehouses
  for each row execute function public.set_updated_at();
```

Todo en una sola migración (RLS + políticas + índice + trigger + GRANT), forward-only.

## Políticas RLS requeridas
Según matriz `docs/arch/permisos-roles.md` y patrón `docs/arch/multitenancy-rls.md`:
- `warehouses_tenant_select` — `for select using (tenant_id in (select user_tenant_ids()))`:
  visible a **todo el equipo** del tenant (owner/admin/member).
- `warehouses_admin_write` — `for insert/update/delete` (o `for all` combinada con la de
  select vía OR de políticas permisivas) `using/with check (user_is_tenant_admin(tenant_id))`:
  solo owner/admin escriben. Se implementa como dos políticas separadas (select amplia +
  write restringida), igual que `memberships` en la migración base.
- `grant select, insert, update, delete on public.warehouses to authenticated, service_role;`
  (GRANT explícito necesario en local — patrón S1-01/S1-05; ver ADR-021 para el proyecto cloud).

## Funciones RPC e invariantes
N/A — CRUD de catálogo sin invariante transaccional (no hay stock que cuadrar; eso llega
con `register_movement` en S2-03). Escritura directa vía `supabase-js` `.insert()/.update()`
con columnas explícitas, protegida por RLS.

## Casos borde
- Nombre vacío o solo espacios → rechazado por Zod antes de llegar a Postgres.
- Archivar una bodega ya archivada → operación idempotente (vuelve a poner `active = false`,
  sin error).
- Un tenant con cero bodegas → empty state con acción "Crear bodega" (no tabla vacía muda).
- `member` que fuerza la URL de edición/archivado → RLS rechaza la escritura; UI ya no le
  muestra los controles (oculta con `visibleNavItems`/gating por rol, igual que `/equipo`).

## Consideraciones de seguridad (docs/arch/seguridad.md)
- Boundary de servidor (Server Action `createWarehouse`/`updateWarehouse`/
  `toggleWarehouseActive`): Zod valida `name` (string, trim, longitud 1–120) antes de
  cualquier operación.
- Inserts/updates con columnas explícitas (`{ tenant_id, name }` / `{ name }` /
  `{ active }`) — nunca spread del input del cliente.
- `tenant_id` se resuelve en servidor vía `getActiveTenant()` (S1-04); el cliente nunca lo
  envía ni lo decide.
- Errores de Postgres (p. ej. RLS `42501` si un `member` fuerza la mutación) se mapean a un
  mensaje genérico en español — nunca se filtra el código/detalle interno al cliente.
- RLS es la frontera real: la UI oculta los controles de escritura a `member` como
  experiencia, no como seguridad (regla de `multitenancy-rls.md`).

## Plan de tests
| Criterio | Tipo | Archivo | Qué verifica |
|---|---|---|---|
| 1, 3 | pgTAP | supabase/tests/S2-01-bodegas.sql | owner/admin crean y editan; `updated_at` cambia |
| 2 | pgTAP | supabase/tests/S2-01-bodegas.sql | member ve pero no puede insert/update/archivar (RLS) |
| 4 | pgTAP | supabase/tests/S2-01-bodegas.sql | archivar/reactivar (`active` toggle), sin borrado físico |
| 5 | pgTAP | supabase/tests/S2-01-bodegas.sql | aislamiento cruzado entre 2 tenants (select y write) |
| 1 | Vitest | src/lib/validation/warehouses.test.ts | schema Zod: nombre válido/vacío/longitud |

## Historial
- 2026-07-20 · creada (draft) al arrancar Sprint 2 (E2 — Inventario), primera historia tras
  cerrar Sprint 1. Decisión de diseño confirmada con el humano: soft-delete vía `active` (no
  `DELETE` físico) para no cerrar la puerta al kardex de S2-03.
- 2026-07-20 · aprobada (draft → approved) por el humano junto con el plan de sesión
  (decisión explícita de implementar en la misma sesión, patrón de RLS espejo de
  `memberships`/S1-05 ya validado). Se implementa con TDD a continuación.
- 2026-07-20 · implementada (approved → implemented). TDD real: pgTAP
  (`supabase/tests/S2-01-bodegas.sql`, 11 tests) y Vitest (`warehouses.test.ts`, 6 tests)
  escritos primero y verificados en rojo (`relation "public.warehouses" does not exist` /
  import fallido); migración `warehouses` después, en verde (41/41 pgTAP con guardián +
  S1-01 + S1-03 + S1-05 + S2-01). RLS con dos políticas separadas (select amplia para todo
  el tenant, insert/update restringidos a `user_is_tenant_admin`), sin política de delete
  (soft-delete vía `active`, sin `DELETE` físico — decisión de la spec). `src/actions/warehouses.ts`
  (`createWarehouse`/`updateWarehouse`/`toggleWarehouseActive`, columnas explícitas,
  `getActiveTenant()`), `src/lib/validation/warehouses.ts` (Zod). UI en
  `/(app)/inventario/bodegas`: listado con `WarehouseRow` (edición inline + archivar/
  reactivar), `WarehouseForm` (crear), gating de controles de gestión por
  `active.role !== "member"` (RLS es la frontera real; la UI solo oculta). Enlace "Bodegas"
  agregado a `/(app)/inventario` (antes placeholder puro).
  **Hallazgo de lint durante TDD**: un primer intento de auto-limpiar el input de creación
  tras un envío exitoso usaba `useEffect` + `setState`, señalado por la regla
  `react-hooks/set-state-in-effect` (anti-patrón: derivar estado en el render, no en un
  efecto) — se simplificó eliminando el auto-reset (el usuario ve la bodega nueva en el
  listado igual). En `WarehouseRow` sí se necesitaba cerrar el modo edición tras un guardado
  exitoso: se usó el patrón oficial de "ajustar estado durante el render" (comparar contra un
  `seenState` con `useState`, sin `useEffect`), que no dispara esa regla.
  Verificado: lint ✓, tsc ✓, Vitest 41/41 ✓, `supabase test db` 41/41 ✓, tipos regenerados
  (`src/lib/database.types.ts`), y los 5 criterios de aceptación con navegador real vía
  script Playwright desechable (no commiteado — e2e formal sigue en S9-01): owner crea
  bodega (nombre recortado) → nombre vacío rechazado con mensaje → edita nombre → archiva
  (tachado) → reactiva → invita a un member (flujo S1-05: signup con `next` → aceptar) →
  member ve el listado pero sin formulario de crear ni botones Editar/Archivar → tenant
  nuevo no ve las bodegas ajenas (aislamiento); 12 checks. Spec movida a `specs/done/`.
  BACKLOG S2-01 → `done`.
