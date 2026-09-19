begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- Fixtures: 3 usuarios y 2 tenants
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-00000000000a', 'Tenant A'),
  ('10000000-0000-0000-0000-00000000000b', 'Tenant B');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'owner', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'owner', '00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-00000000000a', 'member', '00000000-0000-0000-0000-00000000000a');

-- Simular al owner A
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$insert into public.expenses (id, tenant_id, kind, category, description, amount, method, created_by)
    values ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'fixed', 'Arriendo', 'Mes de julio', 1500.00, 'transfer', '00000000-0000-0000-0000-00000000000a')$$,
  'Owner A puede insertar gasto en Tenant A'
);

select is((select count(*)::int from public.expenses), 1, 'Owner A ve su fila');

select throws_ok(
  $$insert into public.expenses (tenant_id, kind, category, description, amount, method, created_by)
    values ('10000000-0000-0000-0000-00000000000b', 'variable', 'Flete', 'Transporte', 100.0, 'cash', '00000000-0000-0000-0000-00000000000a')$$,
  '42501', null, 'Owner A no puede escribir en el tenant B'
);

select throws_ok(
  $$insert into public.expenses (tenant_id, kind, category, description, amount, method, created_by)
    values ('10000000-0000-0000-0000-00000000000a', 'invalido', 'Cat', 'Desc', 100.0, 'cash', '00000000-0000-0000-0000-00000000000a')$$,
  '23514', null, 'Constraint kind rechaza valores invalidos'
);

select throws_ok(
  $$insert into public.expenses (tenant_id, kind, category, description, amount, method, created_by)
    values ('10000000-0000-0000-0000-00000000000a', 'fixed', 'Cat', 'Desc', -100.0, 'cash', '00000000-0000-0000-0000-00000000000a')$$,
  '23514', null, 'Constraint amount > 0 rechaza negativos'
);

-- Simular al member C
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';

select is((select count(*)::int from public.expenses), 0, 'Member C no ve filas de expenses por RLS');

select throws_ok(
  $$insert into public.expenses (tenant_id, kind, category, description, amount, method, created_by)
    values ('10000000-0000-0000-0000-00000000000a', 'fixed', 'Cat', 'Desc', 100.0, 'cash', '00000000-0000-0000-0000-00000000000c')$$,
  '42501', null, 'Member C no puede insertar gastos'
);

select * from finish();
rollback;
