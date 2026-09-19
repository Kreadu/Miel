-- S1-03 — Onboarding: RPC create_tenant_with_owner (atómica, security definer).
-- Ver specs/S1-03-onboarding-crear-empresa.md. C6 actualizado por S11-01 (ADR-026):
-- un usuario ya owner no puede crear una segunda empresa.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000e', 'nuevo-a@test.local'),
  ('00000000-0000-0000-0000-00000000000f', 'nuevo-b@test.local');

-- === Caso feliz: usuario sin membership crea su primera empresa ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000000e", "role": "authenticated"}';

select isnt(
  (select public.create_tenant_with_owner('Miel SAS', '900123456-7')),
  null,
  'C1: caso feliz retorna el id del tenant nuevo');

select is(
  (select count(*)::int from public.tenants where name = 'Miel SAS'),
  1, 'C1: el tenant nuevo quedo creado');

select is(
  (select count(*)::int from public.memberships
   where user_id = '00000000-0000-0000-0000-00000000000e' and role = 'owner'),
  1, 'C1/C3: la membership creada es owner y del propio usuario');

-- === C6 (actualizado por S11-01/ADR-026): un owner no crea una segunda empresa ===
select throws_ok(
  $$select public.create_tenant_with_owner('Miel Norte')$$,
  'P0001', null,
  'C6 (S11-01): un owner no puede crear una segunda empresa');

select is(
  (select count(*)::int from public.memberships
   where user_id = '00000000-0000-0000-0000-00000000000e' and role = 'owner'),
  1, 'C6 (S11-01): sigue con una unica membership owner');

-- === C4: nombre vacío/solo espacios rechazado, sin dejar tenant huerfano ===
select throws_ok(
  $$select public.create_tenant_with_owner('   ')$$,
  'P0001', null,
  'C4: nombre vacio o solo espacios es rechazado por la RPC');

-- === C2: atomicidad estructural — ningun tenant sin su membership owner ===
reset role;
select is(
  (select count(*)::int from public.tenants t
   where not exists (
     select 1 from public.memberships m
     where m.tenant_id = t.id and m.role = 'owner'
   )),
  0, 'C2: ningun tenant quedo sin membership owner (atomicidad)');

-- === C5: usuario anonimo rechazado ===
set local role anon;
set local "request.jwt.claims" to '{"role": "anon"}';
select throws_ok(
  $$select public.create_tenant_with_owner('Empresa anonima')$$,
  'P0001', null,
  'C5: usuario anonimo es rechazado por la RPC');

select * from finish();
rollback;
