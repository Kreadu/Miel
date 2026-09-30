-- S21-04 — activity_log: cada uno registra lo suyo, solo owner/admin lee, sin editar.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000214a01', 'owner-a-s2104@test.local'),
  ('00000000-0000-0000-0000-000000214a02', 'tienda-a-s2104@test.local'),
  ('00000000-0000-0000-0000-000000214b01', 'owner-b-s2104@test.local');
insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-000000214a01', 'Tenant A S21-04'),
  ('10000000-0000-0000-0000-000000214b01', 'Tenant B S21-04');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000214a01', '10000000-0000-0000-0000-000000214a01', 'owner',
   '00000000-0000-0000-0000-000000214a01'),
  ('00000000-0000-0000-0000-000000214a02', '10000000-0000-0000-0000-000000214a01', 'member',
   '00000000-0000-0000-0000-000000214a01'),
  ('00000000-0000-0000-0000-000000214b01', '10000000-0000-0000-0000-000000214b01', 'owner',
   '00000000-0000-0000-0000-000000214b01');
insert into public.workers (id, tenant_id, full_name, doc_number, cost_classification, created_by) values
  ('40000000-0000-0000-0000-000000214a01', '10000000-0000-0000-0000-000000214a01', 'Ana', '1',
   'costo_variable', '00000000-0000-0000-0000-000000214a01'),
  ('40000000-0000-0000-0000-000000214b01', '10000000-0000-0000-0000-000000214b01', 'Beto', '2',
   null, '00000000-0000-0000-0000-000000214b01');

set local role authenticated;

-- === C1: la cuenta de tienda registra una acción de Ana; no la puede leer ni borrar ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000214a02", "role": "authenticated"}';
select lives_ok(
  $$insert into public.activity_log (tenant_id, worker_id, action, detail)
    values ('10000000-0000-0000-0000-000000214a01', '40000000-0000-0000-0000-000000214a01', 'sale_created', 'Pedido')$$,
  'C1: registra la acción');
select is((select count(*)::int from public.activity_log), 0, 'C1: member no lee el registro');

-- === C2: no se puede registrar a nombre de otro ni con trabajador de otra empresa ===
select throws_ok(
  $$insert into public.activity_log (tenant_id, actor_user_id, action)
    values ('10000000-0000-0000-0000-000000214a01', '00000000-0000-0000-0000-000000214a01', 'cash_opened')$$,
  '42501', null, 'C2: no a nombre de otro usuario');
select throws_ok(
  $$insert into public.activity_log (tenant_id, worker_id, action)
    values ('10000000-0000-0000-0000-000000214a01', '40000000-0000-0000-0000-000000214b01', 'cash_opened')$$,
  'P0001', 'worker_invalid', 'C2: trabajador de otra empresa');

-- === C3: el dueño lo lee; otra empresa no ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000214a01", "role": "authenticated"}';
select is((select worker_id from public.activity_log), '40000000-0000-0000-0000-000000214a01'::uuid,
  'C3: owner ve quién lo hizo');
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000214b01", "role": "authenticated"}';
select is((select count(*)::int from public.activity_log), 0, 'C3: aislamiento');

select * from finish();
rollback;
