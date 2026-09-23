-- S14-04 — La empresa se funda solo en el registro inicial.
-- Ver specs/done/S14-04-empresa-solo-en-registro.md, docs/DECISIONS.md ADR-031 (supersede el
-- punto de ADR-026 que permitía al invitado fundar su propia empresa).
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- Fixtures: 2 usuarios sin membresías
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000014a1', 'a-s1404@test.local'),
  ('00000000-0000-0000-0000-0000000014b1', 'b-s1404@test.local');

-- A, sin membresías, crea su primera empresa (caso feliz intacto)
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-0000000014a1", "role": "authenticated"}';

select ok(
  (select public.create_tenant_with_owner('Empresa A S14-04') is not null),
  'usuario sin membresías crea su primera empresa');

-- B es invitado como member al tenant de A (fixture service-level)
reset role;
insert into public.memberships (user_id, tenant_id, role, created_by)
select '00000000-0000-0000-0000-0000000014b1', tenant_id, 'member',
       '00000000-0000-0000-0000-0000000014a1'
  from public.memberships
 where user_id = '00000000-0000-0000-0000-0000000014a1' and role = 'owner';

-- B, invitado (member, nunca owner), ya NO puede crear su propia empresa (invariante nueva)
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-0000000014b1", "role": "authenticated"}';

select throws_ok(
  $$select public.create_tenant_with_owner('Empresa B S14-04')$$,
  'P0001',
  'Ya perteneces a una empresa en Miel. Las empresas se crean solo al registrarte.',
  'invitado member no puede crear su propia empresa (invariante ampliada)');

select is(
  (select count(*)::int from public.memberships
   where user_id = '00000000-0000-0000-0000-0000000014b1' and role = 'owner'),
  0, 'B no queda como owner de nada');

-- A, ya owner, tampoco puede crear una segunda (caso ya cubierto por S11-01, regresión aquí)
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-0000000014a1", "role": "authenticated"}';

select throws_ok(
  $$select public.create_tenant_with_owner('Empresa A2 S14-04')$$,
  'P0001',
  'Ya perteneces a una empresa en Miel. Las empresas se crean solo al registrarte.',
  'owner tampoco puede crear una segunda empresa');

-- Atomicidad: ningún intento fallido dejó tenant huérfano
reset role;
select is(
  (select count(*)::int from public.tenants t
   where not exists (
     select 1 from public.memberships m
      where m.tenant_id = t.id and m.role = 'owner'
   )),
  0, 'ningún tenant quedó sin su membership owner');

select * from finish();
rollback;
