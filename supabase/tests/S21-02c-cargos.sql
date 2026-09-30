-- S21-02c — Cargos (RLS owner/admin, aislamiento) y tipo de trabajador.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000021ca01', 'owner-a-s2102c@test.local'),
  ('00000000-0000-0000-0000-00000021ca02', 'member-a-s2102c@test.local'),
  ('00000000-0000-0000-0000-00000021cb01', 'owner-b-s2102c@test.local');
insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-00000021ca01', 'Tenant A S21-02c'),
  ('10000000-0000-0000-0000-00000021cb01', 'Tenant B S21-02c');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-00000021ca01', '10000000-0000-0000-0000-00000021ca01', 'owner',
   '00000000-0000-0000-0000-00000021ca01'),
  ('00000000-0000-0000-0000-00000021ca02', '10000000-0000-0000-0000-00000021ca01', 'member',
   '00000000-0000-0000-0000-00000021ca01'),
  ('00000000-0000-0000-0000-00000021cb01', '10000000-0000-0000-0000-00000021cb01', 'owner',
   '00000000-0000-0000-0000-00000021cb01');
insert into public.worker_positions (id, tenant_id, name, created_by) values
  ('50000000-0000-0000-0000-00000021cb01', '10000000-0000-0000-0000-00000021cb01', 'Ajeno',
   '00000000-0000-0000-0000-00000021cb01');

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000021ca01", "role": "authenticated"}';

insert into public.worker_positions (id, tenant_id, name) values
  ('50000000-0000-0000-0000-00000021ca01', '10000000-0000-0000-0000-00000021ca01', 'Cajero');
select lives_ok(
  $$insert into public.workers (tenant_id, full_name, doc_number, position_id, worker_type, hourly_rate)
    values ('10000000-0000-0000-0000-00000021ca01', 'Ana', '1', '50000000-0000-0000-0000-00000021ca01',
            'por_horas', 9000)$$,
  'C1: trabajador por horas con cargo de su empresa');
select throws_ok(
  $$insert into public.workers (tenant_id, full_name, doc_number, position_id)
    values ('10000000-0000-0000-0000-00000021ca01', 'Luis', '2', '50000000-0000-0000-0000-00000021cb01')$$,
  'P0001', 'position_invalid', 'C2: cargo de otra empresa');
select throws_ok(
  $$insert into public.workers (tenant_id, full_name, doc_number, worker_type)
    values ('10000000-0000-0000-0000-00000021ca01', 'Eva', '3', 'freelance')$$,
  '23514', null, 'C3: tipo de trabajador fuera de la lista');
select is((select count(*)::int from public.worker_positions), 1, 'C4: A ve solo sus cargos');

set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000021ca02", "role": "authenticated"}';
select is((select count(*)::int from public.worker_positions), 0, 'C5: member no ve cargos');

select * from finish();
rollback;
