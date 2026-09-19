-- S4-02 — Cuentas por pagar y saldos por proveedor
-- Ver specs/S4-02-cuentas-por-pagar.md
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- Fixtures: tenant A y B, proveedores, compras, pagos
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a001', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000b001', 'owner-b@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-00000000a001', 'Tenant A'),
  ('10000000-0000-0000-0000-00000000b001', 'Tenant B');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-00000000a001', '10000000-0000-0000-0000-00000000a001', 'owner',
   '00000000-0000-0000-0000-00000000a001'),
  ('00000000-0000-0000-0000-00000000b001', '10000000-0000-0000-0000-00000000b001', 'owner',
   '00000000-0000-0000-0000-00000000b001');

insert into public.suppliers (id, tenant_id, name, created_by) values
  ('20000000-0000-0000-0000-00000000a001', '10000000-0000-0000-0000-00000000a001',
   'Proveedor A1', '00000000-0000-0000-0000-00000000a001'),
  ('20000000-0000-0000-0000-00000000a002', '10000000-0000-0000-0000-00000000a001',
   'Proveedor A2', '00000000-0000-0000-0000-00000000a001'),
  ('20000000-0000-0000-0000-00000000b001', '10000000-0000-0000-0000-00000000b001',
   'Proveedor B1', '00000000-0000-0000-0000-00000000b001');

-- Compras Proveedor A1:
-- - received: 100
-- - ordered: 50
-- - draft: 50 (ignorado)
-- - cancelled: 50 (ignorado)
-- Total deuda A1 = 150
-- Compras Proveedor A2: ninguna
insert into public.purchases (id, tenant_id, supplier_id, status, subtotal, tax, total, created_by) values
  ('50000000-0000-0000-0000-00000000a001', '10000000-0000-0000-0000-00000000a001',
   '20000000-0000-0000-0000-00000000a001', 'received', 100, 0, 100, '00000000-0000-0000-0000-00000000a001'),
  ('50000000-0000-0000-0000-00000000a002', '10000000-0000-0000-0000-00000000a001',
   '20000000-0000-0000-0000-00000000a001', 'ordered', 50, 0, 50, '00000000-0000-0000-0000-00000000a001'),
  ('50000000-0000-0000-0000-00000000a003', '10000000-0000-0000-0000-00000000a001',
   '20000000-0000-0000-0000-00000000a001', 'draft', 50, 0, 50, '00000000-0000-0000-0000-00000000a001'),
  ('50000000-0000-0000-0000-00000000a004', '10000000-0000-0000-0000-00000000a001',
   '20000000-0000-0000-0000-00000000a001', 'cancelled', 50, 0, 50, '00000000-0000-0000-0000-00000000a001');

-- Pagos Proveedor A1:
-- - Asociado a compra 1: 40
-- - General (anticipo): 20
-- Total pagado A1 = 60
-- Balance A1 = 150 - 60 = 90
-- Pagos Proveedor A2:
-- - General: 30
-- Balance A2 = 0 - 30 = -30
-- La vista se lee vía query normal, el trigger que evalúa RLS no aplica para insert ya que usamos la función
insert into public.supplier_payments (id, tenant_id, supplier_id, purchase_id, amount, method, created_by)
overriding system value
values
  ('60000000-0000-0000-0000-00000000a001', '10000000-0000-0000-0000-00000000a001', '20000000-0000-0000-0000-00000000a001', '50000000-0000-0000-0000-00000000a001', 40, 'transfer', '00000000-0000-0000-0000-00000000a001'),
  ('60000000-0000-0000-0000-00000000a002', '10000000-0000-0000-0000-00000000a001', '20000000-0000-0000-0000-00000000a001', null, 20, 'cash', '00000000-0000-0000-0000-00000000a001'),
  ('60000000-0000-0000-0000-00000000a003', '10000000-0000-0000-0000-00000000a001', '20000000-0000-0000-0000-00000000a002', null, 30, 'transfer', '00000000-0000-0000-0000-00000000a001');

-- Simular Owner A
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000a001", "role": "authenticated"}';

select is(
  (select count(*)::int from public.supplier_balances),
  2,
  'Aislamiento (Tenant A): ve a sus 2 proveedores'
);

select is(
  (select total_purchases from public.supplier_balances where supplier_id = '20000000-0000-0000-0000-00000000a001'),
  150.00::numeric,
  'C1/C2: total_purchases suma solo received y ordered (100 + 50)'
);

select is(
  (select total_paid from public.supplier_balances where supplier_id = '20000000-0000-0000-0000-00000000a001'),
  60.00::numeric,
  'C1: total_paid suma pagos asociados y generales (40 + 20)'
);

select is(
  (select balance from public.supplier_balances where supplier_id = '20000000-0000-0000-0000-00000000a001'),
  90.00::numeric,
  'C1: balance = total_purchases (150) - total_paid (60) = 90'
);

select is(
  (select balance from public.supplier_balances where supplier_id = '20000000-0000-0000-0000-00000000a002'),
  -30.00::numeric,
  'Casos borde: proveedor sin compras pero con pagos tiene balance negativo (anticipo)'
);

select is(
  (select total_purchases from public.supplier_balances where supplier_id = '20000000-0000-0000-0000-00000000a002'),
  0.00::numeric,
  'Casos borde: proveedor sin compras tiene total_purchases 0'
);

-- Simular Owner B
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000b001", "role": "authenticated"}';

select is(
  (select count(*)::int from public.supplier_balances),
  1,
  'Aislamiento (Tenant B): solo ve su proveedor B1'
);

select * from finish();
rollback;
