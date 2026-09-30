-- S22-02 — Línea del estado de resultados en cada categoría de gasto.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000222a01', 'owner-a-s2202@test.local');
insert into public.tenants (id, name) values ('10000000-0000-0000-0000-000000222a01', 'Tenant A S22-02');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000222a01', '10000000-0000-0000-0000-000000222a01', 'owner',
   '00000000-0000-0000-0000-000000222a01');

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000222a01", "role": "authenticated"}';

select is((select pnl_line from public.expense_categories where name = 'Arriendo'), 'operativo',
  'C1: Arriendo es operativo');
select is((select pnl_line from public.expense_categories where name = 'Depreciación y amortización'),
  'depreciacion', 'C1: empresa nueva nace con Depreciación');
select is((select pnl_line from public.expense_categories where name = 'Intereses y gastos financieros'),
  'financiero', 'C1: empresa nueva nace con gastos financieros');
select is((select pnl_line from public.expense_categories where name = 'Impuesto de renta'),
  'impuesto_renta', 'C1: empresa nueva nace con Impuesto de renta');
select throws_ok(
  $$insert into public.expense_categories (tenant_id, name, kind, pnl_line)
    values ('10000000-0000-0000-0000-000000222a01', 'X', 'fixed', 'otra')$$,
  '23514', null, 'C2: línea desconocida rechazada');

select * from finish();
rollback;
