-- S11-01 — Límite de una empresa como owner por usuario.
-- Ver specs/S11-01-limite-un-owner.md, docs/DECISIONS.md ADR-026. Últimas 2 aserciones
-- actualizadas por S14-04/ADR-031: la invariante de creación se amplió de "ya es owner" a "ya
-- tiene cualquier membership" — el member invitado del fixture ya NO puede crear su propia
-- empresa (antes sí).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- Fixtures: 2 usuarios sin membresías (service-level, antes de asumir rol)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

-- Usuario A, sin membresías, crea su primera empresa (regresión del onboarding)
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select ok(
  (select public.create_tenant_with_owner('Empresa A') is not null),
  'usuario sin membresías crea su primera empresa');

select is(
  (select count(*)::int from public.memberships
   where user_id = '00000000-0000-0000-0000-00000000000a' and role = 'owner'),
  1, 'A queda como owner de su empresa');

-- Ya owner: una segunda empresa está prohibida (invariante nueva)
select throws_ok(
  $$select public.create_tenant_with_owner('Empresa A2')$$,
  'P0001',
  'Ya perteneces a una empresa en Miel. Las empresas se crean solo al registrarte.',
  'owner no puede crear una segunda empresa');

-- Atomicidad: el intento fallido no dejó tenant parcial
reset role;
select is((select count(*)::int from public.tenants), 1,
  'el intento fallido no creó ningún tenant');

-- B es invitado como member al tenant de A (fixture service-level)
insert into public.memberships (user_id, tenant_id, role, created_by)
select '00000000-0000-0000-0000-00000000000b', tenant_id, 'member',
       '00000000-0000-0000-0000-00000000000a'
  from public.memberships
 where user_id = '00000000-0000-0000-0000-00000000000a' and role = 'owner';

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select throws_ok(
  $$select public.create_tenant_with_owner('Empresa B')$$,
  'P0001',
  'Ya perteneces a una empresa en Miel. Las empresas se crean solo al registrarte.',
  'member invitado ya NO puede crear su propia empresa (S14-04/ADR-031)');

select is(
  (select count(*)::int from public.memberships
   where user_id = '00000000-0000-0000-0000-00000000000b' and role = 'owner'),
  0, 'B no queda como owner de nada');

select * from finish();
rollback;
