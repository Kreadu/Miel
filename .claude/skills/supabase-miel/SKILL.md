---
name: supabase-miel
description: Procedimiento de la capa de datos del proyecto Miel. Usar SIEMPRE antes de escribir migraciones, funciones RPC o tests pgTAP en supabase/ — da el flujo de trabajo y las plantillas completas (RLS, aislamiento de tenant, invariantes, atomicidad). El QUÉ (esquema, patrones) vive en la wiki; este skill es el CÓMO.
---

# Supabase en Miel — procedimiento de la capa de datos

Fuentes de verdad (leer la que aplique, no duplicar aquí su contenido):
`docs/data-model.md` (esquema), `docs/arch/multitenancy-rls.md` (patrón de políticas),
`docs/arch/patron-rpc.md` (plantilla de función), `docs/arch/convenciones-sql.md` (naming/tipos).

## Flujo por historia con BD (orden estricto)

1. La spec `approved` define tablas/RPCs/invariantes — no inventar sobre la marcha.
2. `supabase migration new <slug>` (nunca crear el archivo a mano: el timestamp del CLI ordena).
3. Escribir los tests pgTAP ANTES de implementar la RPC (TDD; el guardián ya cubre RLS).
4. `supabase db reset` local (aplica todo desde cero) → `supabase test db`.
5. Si el esquema cambió: regenerar tipos —
   `supabase gen types typescript --local > src/lib/database.types.ts`.

## Migración de tabla nueva (todo en la MISMA migración)

```sql
create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  name text not null,
  created_at timestamptz not null default now()
);

create index warehouses_tenant_id_idx on public.warehouses (tenant_id);
-- + un índice por cada FK adicional

alter table public.warehouses enable row level security;

create policy "warehouses_tenant_select" on public.warehouses for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "warehouses_tenant_write" on public.warehouses for all
  using (tenant_id in (select public.user_tenant_ids()))
  with check (tenant_id in (select public.user_tenant_ids()));
```

Restricciones por rol: política adicional consultando `memberships.role` (la spec las define).
Forward-only: una migración aplicada jamás se edita — se corrige con otra.

## Test pgTAP de aislamiento (plantilla, uno por tabla nueva)

Archivo `supabase/tests/S<sprint>-<id>-<slug>.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

-- Fixtures: 2 usuarios y 2 tenants (service-level, antes de asumir rol)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');
insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-00000000000a', 'Tenant A'),
  ('10000000-0000-0000-0000-00000000000b', 'Tenant B');
insert into public.memberships (user_id, tenant_id, role) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'owner'),
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'owner');
insert into public.warehouses (tenant_id, name) values
  ('10000000-0000-0000-0000-00000000000a', 'Bodega A'),
  ('10000000-0000-0000-0000-00000000000b', 'Bodega B');

-- Simular al usuario A
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is((select count(*)::int from public.warehouses), 1, 'A ve solo sus filas');
select is(
  (select count(*)::int from public.warehouses
   where tenant_id = '10000000-0000-0000-0000-00000000000b'),
  0, 'A no ve filas del tenant B');
select throws_ok(
  $$insert into public.warehouses (tenant_id, name)
    values ('10000000-0000-0000-0000-00000000000b', 'intrusa')$$,
  '42501', null, 'A no puede escribir en el tenant B');

select * from finish();
rollback;
```

Claves: todo dentro de `begin…rollback` (no deja rastro); `set local` para que el rol muera
con la transacción. 

**Trampa de Fixtures y RLS (Descubierta en S3-04):** Si a mitad del test necesitas mutar estado (ej. un `UPDATE` directo sobre `purchases` para cambiar un fixture) y la tabla tiene RLS estricta de solo lectura (como suele pasar cuando la escritura va por RPC), un `UPDATE` fallará con "permission denied" si estás bajo `set local role authenticated`. **Solución:** Ejecuta `reset role;` (o `set local role postgres;`) justo ANTES de mutar el fixture, haz el `UPDATE/INSERT`, y vuelve a configurar `set local role authenticated` con los claims del JWT para seguir probando.

## Vistas o funciones `security definer` sobre tablas con RLS (columnas sensibles)

Cuando una tabla tiene columnas sensibles que solo ciertos roles de membresía deben leer (p. ej.
`cost`/`price` — ver `permisos-roles.md`), Postgres no tiene RLS a nivel de columna condicionada
por rol de membresía: la solución es una vista `security invoker = false` (o función `security
definer`) que enmascara esas columnas con `case when user_is_tenant_admin(tenant_id) then col
else null end`.

**Trampa descubierta en S2-02 (no asumir que basta con `FORCE ROW LEVEL SECURITY`)**: en
Supabase el dueño de las tablas (`postgres`) tiene `rolbypassrls = true` — confirmable con
`select rolbypassrls from pg_roles where rolname = 'postgres';`. Ese bypass **gana sobre
`FORCE ROW LEVEL SECURITY`**, así que una vista que corre con los privilegios del dueño de la
tabla NO queda acotada por la política de aislamiento de la tabla, aunque la tabla tenga
`force row level security`. El resultado: la vista devuelve filas de **todos los tenants**.

Mecanismo correcto: repetir el filtro de tenant **explícitamente** en el `where` de la propia
vista/función, usando el mismo helper `user_tenant_ids()` que usa la política de la tabla —
nunca depender de que Postgres aplique la política automáticamente a través de la vista:

```sql
create view public.products_catalog as
select
  id, tenant_id, sku, name, /* … columnas no sensibles … */,
  case when public.user_is_tenant_admin(tenant_id) then cost else null end as cost,
  case when public.user_is_tenant_admin(tenant_id) then price else null end as price
from public.products
where tenant_id in (select public.user_tenant_ids());  -- obligatorio, no opcional
```

Además, restringir el `GRANT SELECT` columnar de las columnas sensibles en la tabla base
(no otorgarlas a `authenticated`) para que una consulta directa a la tabla (sin pasar por la
vista) falle con "permission denied" en vez de exponer el dato.

Test pgTAP obligatorio para este patrón: un usuario del tenant A consultando la vista **no**
debe ver filas del tenant B (además del test de la tabla base) — es el caso que detectó este
bug en S2-02, y solo se vio con verificación manual en navegador hasta que se sumó.

## Test pgTAP de RPC (uno por función, según spec)

Cubrir SIEMPRE, con `plan(n)` exacto:
1. **Caso feliz**: la función retorna lo esperado y el estado queda consistente
   (`is`, `results_eq`).
2. **Cada violación de invariante**: `throws_ok($$select register_movement(...)$$, ...)` —
   un test por invariante listado en la spec (p. ej. stock < 0, pago > saldo).
3. **Atomicidad**: tras una llamada que falla, verificar que NO quedó estado parcial
   (contar filas antes y después: iguales).
4. **Tenant ajeno**: invocar la RPC apuntando a registros de otro tenant → debe fallar o
   no encontrar (RLS aplica dentro por `security invoker`).

## Errores en RPC

- Violación de invariante: `raise exception 'stock insuficiente para %', p_product_id
  using errcode = 'P0001';` — mensaje claro, la Server Action lo traduce a `{ ok: false }`.
- No usar códigos genéricos para reglas de negocio distintas si la UI debe diferenciarlas:
  la spec fija los mensajes/códigos.

## Checklist de salida (capa de datos)

- [ ] `supabase db reset` aplica todas las migraciones en limpio, sin error.
- [ ] `supabase test db` verde, incluido `00-rls-guard.sql` (jamás excluir tablas del guardián).
- [ ] Tabla nueva → test de aislamiento propio. RPC nueva → feliz + invariantes + atomicidad.
- [ ] `src/lib/database.types.ts` regenerado si el esquema cambió.
- [ ] Ninguna migración previa editada (forward-only).
