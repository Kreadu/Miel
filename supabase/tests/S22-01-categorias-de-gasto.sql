-- S22-01 — Categorías de gasto: lista inicial por empresa, tipo impuesto por la categoría, RLS.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000221a01', 'owner-a-s2201@test.local'),
  ('00000000-0000-0000-0000-000000221a02', 'member-a-s2201@test.local');
insert into public.tenants (id, name) values ('10000000-0000-0000-0000-000000221a01', 'Tenant A S22-01');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000221a01', '10000000-0000-0000-0000-000000221a01', 'owner',
   '00000000-0000-0000-0000-000000221a01'),
  ('00000000-0000-0000-0000-000000221a02', '10000000-0000-0000-0000-000000221a01', 'member',
   '00000000-0000-0000-0000-000000221a01');

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000221a01", "role": "authenticated"}';

-- === C1: una empresa nueva nace con la lista inicial ===
select is((select kind from public.expense_categories where name = 'Arriendo'), 'fixed', 'C1: Arriendo es fijo');
select is((select kind from public.expense_categories where name = 'Publicidad y marketing'), 'variable',
  'C1: Publicidad es variable');

-- === C2: el tipo lo pone la categoría aunque se envíe otro ===
insert into public.expenses (tenant_id, kind, category, description, amount, method, created_by) values
  ('10000000-0000-0000-0000-000000221a01', 'variable', 'Arriendo', 'Local', 1000, 'transfer',
   '00000000-0000-0000-0000-000000221a01');
select is((select kind from public.expenses where category = 'Arriendo'), 'fixed',
  'C2: gasto de Arriendo queda fijo aunque se haya enviado variable');

-- === C3: categoría propia con su tipo ===
insert into public.expense_categories (tenant_id, name, kind) values
  ('10000000-0000-0000-0000-000000221a01', 'Música ambiental', 'fixed');
insert into public.expenses (tenant_id, kind, category, description, amount, method, created_by) values
  ('10000000-0000-0000-0000-000000221a01', 'variable', 'Música ambiental', 'Spotify', 20, 'card',
   '00000000-0000-0000-0000-000000221a01');
select is((select kind from public.expenses where category = 'Música ambiental'), 'fixed',
  'C3: categoría propia fija su tipo');

-- === C4: un operativo no ve ni crea categorías ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000221a02", "role": "authenticated"}';
select is((select count(*)::int from public.expense_categories), 0, 'C4: member no ve categorías');
select throws_ok(
  $$insert into public.expense_categories (tenant_id, name, kind)
    values ('10000000-0000-0000-0000-000000221a01', 'X', 'fixed')$$,
  '42501', null, 'C4: member no crea categorías');

select * from finish();
rollback;
