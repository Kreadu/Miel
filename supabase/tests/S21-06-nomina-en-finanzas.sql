-- S21-06 — Nómina en Finanzas: solo períodos cerrados, según clasificación, solo owner/admin.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000216a01', 'owner-a-s2106@test.local'),
  ('00000000-0000-0000-0000-000000216a02', 'member-a-s2106@test.local');
insert into public.tenants (id, name) values ('10000000-0000-0000-0000-000000216a01', 'Tenant A S21-06');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000216a01', '10000000-0000-0000-0000-000000216a01', 'owner',
   '00000000-0000-0000-0000-000000216a01'),
  ('00000000-0000-0000-0000-000000216a02', '10000000-0000-0000-0000-000000216a01', 'member',
   '00000000-0000-0000-0000-000000216a01');
insert into public.workers (id, tenant_id, full_name, doc_number, cost_classification, created_by) values
  ('40000000-0000-0000-0000-000000216a01', '10000000-0000-0000-0000-000000216a01', 'Operaria', '1',
   'costo_variable', '00000000-0000-0000-0000-000000216a01'),
  ('40000000-0000-0000-0000-000000216a02', '10000000-0000-0000-0000-000000216a01', 'Contador', '2',
   null, '00000000-0000-0000-0000-000000216a01');
insert into public.payroll_periods (id, tenant_id, period_start, period_end, status, created_by) values
  ('60000000-0000-0000-0000-000000216a01', '10000000-0000-0000-0000-000000216a01', '2026-09-01', '2026-09-30',
   'closed', '00000000-0000-0000-0000-000000216a01'),
  ('60000000-0000-0000-0000-000000216a02', '10000000-0000-0000-0000-000000216a01', '2026-10-01', '2026-10-31',
   'draft', '00000000-0000-0000-0000-000000216a01');
-- costo = devengado + aportes + provisiones: 1000 + 200 + 100 = 1300 y 2000 + 400 + 200 = 2600
insert into public.payroll_settlements (tenant_id, period_id, worker_id, gross_earnings, total_deductions, net_pay, result) values
  ('10000000-0000-0000-0000-000000216a01', '60000000-0000-0000-0000-000000216a01', '40000000-0000-0000-0000-000000216a01',
   1000, 80, 920, '{"employerContributions": {"totalContributions": 200}, "provisions": {"totalProvisions": 100}}'),
  ('10000000-0000-0000-0000-000000216a01', '60000000-0000-0000-0000-000000216a01', '40000000-0000-0000-0000-000000216a02',
   2000, 160, 1840, '{"employerContributions": {"totalContributions": 400}, "provisions": {"totalProvisions": 200}}'),
  ('10000000-0000-0000-0000-000000216a01', '60000000-0000-0000-0000-000000216a02', '40000000-0000-0000-0000-000000216a01',
   9999, 0, 9999, '{}');

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000216a01", "role": "authenticated"}';

select is((select labor_cost from public.monthly_payroll where classification = 'costo_variable'),
  1300.00::numeric, 'C1: costo de la operaria (devengado + aportes + provisiones)');
select is((select labor_cost from public.monthly_payroll where classification = 'gasto_fijo'),
  2600.00::numeric, 'C1: sin clasificar cuenta como gasto fijo');
select is((select count(*)::int from public.monthly_payroll where month = '2026-10'), 0,
  'C2: el período abierto no cuenta');
select is((select payroll_costs::text || '|' || payroll_expenses::text || '|' || utility::text
           from public.monthly_pnl where month = '2026-09'),
  '1300.00|2600.00|-3900.00', 'C3: el estado de resultados descuenta la nómina');
select is((select amount from public.monthly_expenses where category = 'Nómina'), 2600.00::numeric,
  'C4: la nómina como gasto aparece en gastos por mes');
select is((select cash_out from public.cash_flow where month = '2026-09'), 3600.00::numeric,
  'C5: sale de caja devengado + aportes (1200 + 2400)');

set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000216a02", "role": "authenticated"}';
select is((select count(*)::int from public.monthly_payroll), 0, 'C6: un operativo no ve la nómina');

select * from finish();
rollback;
