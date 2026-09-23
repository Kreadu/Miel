-- S15-02 — member puede crear clientes (ADR-033), pero no editarlos ni archivarlos.
-- Ver specs/S15-02-alta-rapida-cliente-pos.md, docs/arch/permisos-roles.md.

begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

-- Fixtures: 2 usuarios (owner A, member A) en tenant A + 1 usuario en tenant B.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000015a1', 'owner-a-s1502@test.local'),
  ('00000000-0000-0000-0000-0000000015a2', 'member-a-s1502@test.local'),
  ('00000000-0000-0000-0000-0000000015b1', 'owner-b-s1502@test.local');
insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-0000000015a1', 'Tenant A S15-02'),
  ('10000000-0000-0000-0000-0000000015b1', 'Tenant B S15-02');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-0000000015a1', '10000000-0000-0000-0000-0000000015a1', 'owner',
    '00000000-0000-0000-0000-0000000015a1'),
  ('00000000-0000-0000-0000-0000000015a2', '10000000-0000-0000-0000-0000000015a1', 'member',
    '00000000-0000-0000-0000-0000000015a1'),
  ('00000000-0000-0000-0000-0000000015b1', '10000000-0000-0000-0000-0000000015b1', 'owner',
    '00000000-0000-0000-0000-0000000015b1');

-- Simular al member del tenant A.
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-0000000015a2", "role": "authenticated"}';

-- === C1: member SÍ puede crear cliente en su propio tenant (ADR-033) ===
insert into public.customers (id, tenant_id, name)
  values ('30000000-0000-0000-0000-0000000015c1', '10000000-0000-0000-0000-0000000015a1',
    'Cliente creado por member');

select is(
  (select name from public.customers where id = '30000000-0000-0000-0000-0000000015c1'),
  'Cliente creado por member', 'C1: member crea cliente en su tenant');

-- === C2: member NO puede archivar el cliente que acaba de crear (update sigue admin-only) ===
update public.customers set active = false
  where id = '30000000-0000-0000-0000-0000000015c1';

select is(
  (select active from public.customers where id = '30000000-0000-0000-0000-0000000015c1'),
  true, 'C2: member no puede archivar cliente (el valor no cambia, RLS de update intacta)');

-- === C3: member A no puede crear cliente en el tenant B (aislamiento) ===
select throws_ok(
  $$insert into public.customers (tenant_id, name)
    values ('10000000-0000-0000-0000-0000000015b1', 'intruso')$$,
  '42501', null, 'C3: member A no puede crear cliente en el tenant B');

-- === C4: owner sigue pudiendo crear cliente (sin regresión) ===
reset role;
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-0000000015a1", "role": "authenticated"}';

insert into public.customers (id, tenant_id, name)
  values ('30000000-0000-0000-0000-0000000015c2', '10000000-0000-0000-0000-0000000015a1',
    'Cliente creado por owner');

select is(
  (select name from public.customers where id = '30000000-0000-0000-0000-0000000015c2'),
  'Cliente creado por owner', 'C4: owner sigue creando clientes (sin regresión)');

select * from finish();
rollback;
