-- S21-02 — Trabajadores y categorías: solo owner/admin, aislamiento, coherencia de referencias.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000212a01', 'owner-a-s2102@test.local'),
  ('00000000-0000-0000-0000-000000212a02', 'member-a-s2102@test.local'),
  ('00000000-0000-0000-0000-000000212b01', 'owner-b-s2102@test.local');
insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-000000212a01', 'Tenant A S21-02'),
  ('10000000-0000-0000-0000-000000212b01', 'Tenant B S21-02');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000212a01', '10000000-0000-0000-0000-000000212a01', 'owner',
   '00000000-0000-0000-0000-000000212a01'),
  ('00000000-0000-0000-0000-000000212a02', '10000000-0000-0000-0000-000000212a01', 'member',
   '00000000-0000-0000-0000-000000212a01'),
  ('00000000-0000-0000-0000-000000212b01', '10000000-0000-0000-0000-000000212b01', 'owner',
   '00000000-0000-0000-0000-000000212b01');
insert into public.worker_categories (id, tenant_id, name, modules, created_by) values
  ('30000000-0000-0000-0000-000000212b01', '10000000-0000-0000-0000-000000212b01', 'Ajena', '{ventas}',
   '00000000-0000-0000-0000-000000212b01');

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000212a01", "role": "authenticated"}';

-- === C1: owner crea categoría con módulos válidos y un trabajador en ella ===
insert into public.worker_categories (id, tenant_id, name, modules) values
  ('30000000-0000-0000-0000-000000212a01', '10000000-0000-0000-0000-000000212a01', 'Vendedor',
   '{ventas}');
insert into public.workers (tenant_id, full_name, doc_number, salary, category_id) values
  ('10000000-0000-0000-0000-000000212a01', 'Ana Pérez', '1010', 1423500,
   '30000000-0000-0000-0000-000000212a01');
select is((select count(*)::int from public.workers), 1, 'C1: owner crea trabajador');

-- === C2: módulo desconocido rechazado ===
select throws_ok(
  $$insert into public.worker_categories (tenant_id, name, modules)
    values ('10000000-0000-0000-0000-000000212a01', 'Rara', '{finanzas}')$$,
  '23514', null, 'C2: módulo fuera de la lista');

-- === C3: categoría de otra empresa rechazada ===
select throws_ok(
  $$insert into public.workers (tenant_id, full_name, doc_number, category_id)
    values ('10000000-0000-0000-0000-000000212a01', 'Luis', '2020', '30000000-0000-0000-0000-000000212b01')$$,
  'P0001', 'category_invalid', 'C3: categoría ajena');

-- === C4: documento repetido en la misma empresa rechazado ===
select throws_ok(
  $$insert into public.workers (tenant_id, full_name, doc_number)
    values ('10000000-0000-0000-0000-000000212a01', 'Otra Ana', '1010')$$,
  '23505', null, 'C4: documento único por empresa');

-- === C5: member no ve ni crea trabajadores (salarios) ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000212a02", "role": "authenticated"}';
select is((select count(*)::int from public.workers), 0, 'C5: member no ve trabajadores');
select is((select count(*)::int from public.worker_categories), 0, 'C5: member no ve categorías');
select throws_ok(
  $$insert into public.workers (tenant_id, full_name, doc_number)
    values ('10000000-0000-0000-0000-000000212a01', 'Intruso', '9999')$$,
  '42501', null, 'C5: member no crea trabajadores');

-- === C6: aislamiento ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000212b01", "role": "authenticated"}';
select is((select count(*)::int from public.workers), 0, 'C6: B no ve trabajadores de A');

select * from finish();
rollback;
