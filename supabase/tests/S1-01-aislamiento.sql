-- S1-01 — Esquema base multitenant: aislamiento de tenant y restricciones de rol.
-- Ver specs/S1-01-tenants-auth.md (criterios 2, 3, 4, 6). Criterios 1 y 5 los cubre el
-- guardián 00-rls-guard.sql.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Fixtures: 3 usuarios (2 owners + 1 member) y 2 tenants.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'member-a@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-00000000000a', 'Tenant A'),
  ('10000000-0000-0000-0000-00000000000b', 'Tenant B');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'owner',
   '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'owner',
   '00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-00000000000a', 'member',
   '00000000-0000-0000-0000-00000000000a');

-- === Simular al owner del tenant A ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is(
  (select count(*)::int from public.tenants), 1,
  'C2: owner de A ve solo su tenant');
select is(
  (select count(*)::int from public.memberships
   where tenant_id = '10000000-0000-0000-0000-00000000000b'),
  0, 'C2: owner de A no ve memberships del tenant B');

select throws_ok(
  $$delete from public.tenants
    where id = '10000000-0000-0000-0000-00000000000a'$$,
  '42501', null,
  'C6: owner de A no puede borrar su propio tenant (sin politica de delete)');

-- === Simular al member del tenant A ===
reset role;
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';

select throws_ok(
  $$insert into public.memberships (user_id, tenant_id, role)
    values ('00000000-0000-0000-0000-00000000000a',
            '10000000-0000-0000-0000-00000000000a', 'member')$$,
  '42501', null,
  'C4: member de A no puede insertar membership en A');

select throws_ok(
  $$insert into public.memberships (user_id, tenant_id, role)
    values ('00000000-0000-0000-0000-00000000000a',
            '10000000-0000-0000-0000-00000000000b', 'member')$$,
  '42501', null,
  'C4: member de A no puede insertar membership en B');

-- Regresión S1-05: la RLS de memberships es amplia a todo el equipo del tenant (la
-- necesita /equipo para listar compañeros), NO solo a la fila propia. Este es el hecho
-- exacto que hacía invisible el bug de getActiveTenant() con tenants de ≥2 miembros —
-- sin filtro explícito por user_id, la query devolvía una fila por compañero y el
-- primero por created_at (el owner) pisaba el rol real del usuario (ver
-- src/lib/tenant/server.ts y SESSION_LOG sesión (r)).
select is(
  (select count(*)::int from public.memberships
   where tenant_id = '10000000-0000-0000-0000-00000000000a'),
  2, 'S1-05-regresion: member de A ve el equipo completo de su tenant (RLS amplia)');
select is(
  (select role from public.memberships
   where tenant_id = '10000000-0000-0000-0000-00000000000a'
     and user_id = '00000000-0000-0000-0000-00000000000a'),
  'owner',
  'S1-05-regresion: member de A ve la fila del owner de su tenant, no solo la propia');

-- === Simular a un usuario autenticado sin ninguna membership ===
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000d', 'sin-membership@test.local');
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000000d", "role": "authenticated"}';

select is(
  (select count(*)::int from public.tenants), 0,
  'C3: usuario sin membership ve 0 filas en tenants');
select is(
  (select count(*)::int from public.memberships), 0,
  'C3: usuario sin membership ve 0 filas en memberships');

select * from finish();
rollback;
