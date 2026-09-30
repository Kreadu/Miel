-- S21-05 — Nómina: RLS owner/admin, aislamiento, coherencia y consecutivo DIAN atómico.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000215a01', 'owner-a-s2105@test.local'),
  ('00000000-0000-0000-0000-000000215a02', 'member-a-s2105@test.local'),
  ('00000000-0000-0000-0000-000000215b01', 'owner-b-s2105@test.local');
insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-000000215a01', 'Tenant A S21-05'),
  ('10000000-0000-0000-0000-000000215b01', 'Tenant B S21-05');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000215a01', '10000000-0000-0000-0000-000000215a01', 'owner',
   '00000000-0000-0000-0000-000000215a01'),
  ('00000000-0000-0000-0000-000000215a02', '10000000-0000-0000-0000-000000215a01', 'member',
   '00000000-0000-0000-0000-000000215a01'),
  ('00000000-0000-0000-0000-000000215b01', '10000000-0000-0000-0000-000000215b01', 'owner',
   '00000000-0000-0000-0000-000000215b01');
insert into public.workers (id, tenant_id, full_name, doc_number, salary, created_by) values
  ('40000000-0000-0000-0000-000000215a01', '10000000-0000-0000-0000-000000215a01', 'Ana', '1', 2000000,
   '00000000-0000-0000-0000-000000215a01'),
  ('40000000-0000-0000-0000-000000215b01', '10000000-0000-0000-0000-000000215b01', 'Beto', '2', 2000000,
   '00000000-0000-0000-0000-000000215b01');

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000215a01", "role": "authenticated"}';

-- === C1: owner crea período, liquidación y licencia de su trabajador ===
insert into public.payroll_periods (id, tenant_id, period_start, period_end) values
  ('60000000-0000-0000-0000-000000215a01', '10000000-0000-0000-0000-000000215a01', '2026-09-01', '2026-09-30');
insert into public.payroll_settlements (tenant_id, period_id, worker_id, days_worked, net_pay) values
  ('10000000-0000-0000-0000-000000215a01', '60000000-0000-0000-0000-000000215a01',
   '40000000-0000-0000-0000-000000215a01', 30, 1800000);
insert into public.worker_leaves (tenant_id, worker_id, type, start_date, end_date) values
  ('10000000-0000-0000-0000-000000215a01', '40000000-0000-0000-0000-000000215a01',
   'GENERAL_INCAPACITY', '2026-09-10', '2026-09-12');
select is((select count(*)::int from public.payroll_settlements), 1, 'C1: liquidación creada');

-- === C2: trabajador de otra empresa y fechas invertidas se rechazan ===
select throws_ok(
  $$insert into public.worker_leaves (tenant_id, worker_id, type, start_date, end_date)
    values ('10000000-0000-0000-0000-000000215a01', '40000000-0000-0000-0000-000000215b01',
            'GENERAL_INCAPACITY', '2026-09-01', '2026-09-02')$$,
  'P0001', 'worker_invalid', 'C2: licencia de un trabajador ajeno');
select throws_ok(
  $$insert into public.worker_leaves (tenant_id, worker_id, type, start_date, end_date)
    values ('10000000-0000-0000-0000-000000215a01', '40000000-0000-0000-0000-000000215a01',
            'MATERNITY_LEAVE', '2026-09-10', '2026-09-01')$$,
  '23514', null, 'C2: fin antes del inicio');

-- === C3: consecutivo DIAN atómico y por empresa ===
select is(public.next_dian_consecutive('10000000-0000-0000-0000-000000215a01'), 1, 'C3: primer consecutivo');
select is(public.next_dian_consecutive('10000000-0000-0000-0000-000000215a01'), 2, 'C3: segundo consecutivo');

-- === C3b: crear período con liquidaciones de una vez ===
select isnt(
  public.create_payroll_period('10000000-0000-0000-0000-000000215a01', '2026-10-01', '2026-10-31',
    '[{"worker_id": "40000000-0000-0000-0000-000000215a01", "days_worked": 30, "net_pay": 1900000}]'::jsonb),
  null, 'C3b: período creado');
select throws_ok(
  $$select public.create_payroll_period('10000000-0000-0000-0000-000000215a01', '2026-11-01', '2026-11-30',
    '[{"worker_id": "40000000-0000-0000-0000-000000215b01", "days_worked": 30}]'::jsonb)$$,
  'P0001', 'worker_invalid', 'C3b: trabajador ajeno → nada queda guardado');

-- === C4: member no ve nómina ni pide consecutivos ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000215a02", "role": "authenticated"}';
select is((select count(*)::int from public.payroll_settlements), 0, 'C4: member no ve liquidaciones');
select throws_ok(
  $$select public.next_dian_consecutive('10000000-0000-0000-0000-000000215a01')$$,
  'P0001', 'permission_denied', 'C4: member no pide consecutivo');

-- === C5: aislamiento ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000215b01", "role": "authenticated"}';
select is((select count(*)::int from public.worker_leaves), 0, 'C5: B no ve licencias de A');

select * from finish();
rollback;
