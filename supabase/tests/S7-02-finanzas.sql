begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- Fixtures: 2 tenants, 2 usuarios, 2 owner memberships
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'member@test.local');
insert into public.tenants (id, name, currency) values
  ('10000000-0000-0000-0000-00000000000a', 'Tenant A', 'COP'),
  ('10000000-0000-0000-0000-00000000000b', 'Tenant B', 'COP');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'owner', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'owner', '00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-00000000000a', 'member', '00000000-0000-0000-0000-00000000000a');

-- Fixtures para Finanzas
-- 1. Un producto y un cliente
insert into public.products (id, tenant_id, sku, name, kind, created_by) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'SKU-01', 'Prod A', 'resale', '00000000-0000-0000-0000-00000000000a');
insert into public.customers (id, tenant_id, doc_type, doc_number, name, created_by) values
  ('30000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'nit', '123', 'Cliente A', '00000000-0000-0000-0000-00000000000a');
insert into public.suppliers (id, tenant_id, nit, name, created_by) values
  ('40000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '456', 'Prov A', '00000000-0000-0000-0000-00000000000a');

-- Una venta entregada en 2026-07-01
insert into public.sales (id, tenant_id, customer_id, status, issued_at, subtotal, tax, total, receipt_number, created_by) values
  ('50000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-00000000000a', 'delivered', '2026-07-01 10:00:00-05', 100, 19, 119, 1, '00000000-0000-0000-0000-00000000000a');
insert into public.sale_items (sale_id, tenant_id, product_id, qty, unit_price, discount, unit_cost, tax_rate) values
  ('50000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 2, 60, 20, 30, 19);
-- Ingreso neto = 2 * 60 - 20 = 100. Costo = 2 * 30 = 60.

-- Un cobro de cliente
insert into public.customer_payments (id, tenant_id, customer_id, sale_id, amount, paid_at, method, created_by) values
  ('60000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-00000000000a', 119, '2026-07-02 10:00:00-05', 'transfer', '00000000-0000-0000-0000-00000000000a');

-- Un gasto
insert into public.expenses (id, tenant_id, kind, category, description, amount, paid_at, method, created_by) values
  ('70000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'fixed', 'Arriendo', 'Arriendo de julio', 15, '2026-07-03 10:00:00-05', 'transfer', '00000000-0000-0000-0000-00000000000a');

-- Caso borde: gasto en un mes sin ventas (2026-08) para probar el FULL OUTER JOIN
insert into public.expenses (id, tenant_id, kind, category, description, amount, paid_at, method, created_by) values
  ('70000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000a', 'variable', 'Servicios', 'Agua de agosto', 8, '2026-08-03 10:00:00-05', 'transfer', '00000000-0000-0000-0000-00000000000a');

-- Caso borde: producto B con venta descontada al 100% (ingreso neto = 0) para probar la
-- guarda de division por cero en product_profitability, sin contaminar los totales de julio
-- del producto A ni de las vistas mensuales usadas en los tests 1 y 2 (mes distinto).
insert into public.products (id, tenant_id, sku, name, kind, created_by) values
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000a', 'SKU-02', 'Prod B', 'resale', '00000000-0000-0000-0000-00000000000a');
insert into public.sales (id, tenant_id, customer_id, status, issued_at, subtotal, tax, total, receipt_number, created_by) values
  ('50000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-00000000000a', 'delivered', '2026-09-05 10:00:00-05', 0, 0, 0, 2, '00000000-0000-0000-0000-00000000000a');
insert into public.sale_items (sale_id, tenant_id, product_id, qty, unit_price, discount, unit_cost, tax_rate) values
  ('50000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000b', 1, 50, 50, 20, 0);
-- Ingreso neto = 1 * 50 - 50 = 0. Costo = 1 * 20 = 20. margin_percent debe ser 0, no una excepcion.

-- Simular al usuario owner (A)
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

-- Test 1: monthly_pnl
-- mes = '2026-07', ingresos = 100, cogs = 60, gastos = 15, utilidad = 25
select is(
  (select row_to_json(r) from (select month, income, cogs, expenses, utility from public.monthly_pnl where month = '2026-07') r)::text,
  '{"month":"2026-07","income":100.00,"cogs":60.00,"expenses":15.00,"utility":25.00}',
  'owner puede ver y calcular el P&L mensual correctamente'
);

-- Test 2: cash_flow
-- mes = '2026-07', cash_in = 119, cash_out = 15, net = 104
select is(
  (select row_to_json(r) from (select month, cash_in, cash_out, net_cash from public.cash_flow where month = '2026-07') r)::text,
  '{"month":"2026-07","cash_in":119.00,"cash_out":15.00,"net_cash":104.00}',
  'owner puede ver y calcular el flujo de caja correctamente'
);

-- Test 3: product_profitability
-- sold_qty = 2, net_income = 100, total_cost = 60, margin_amount = 40, margin_percent = 40
select is(
  (select row_to_json(r) from (select product_id, sku, name, sold_qty, net_income, total_cost, margin_amount, margin_percent from public.product_profitability where product_id = '20000000-0000-0000-0000-00000000000a') r)::text,
  '{"product_id":"20000000-0000-0000-0000-00000000000a","sku":"SKU-01","name":"Prod A","sold_qty":2.000,"net_income":100.00,"total_cost":60.00,"margin_amount":40.00,"margin_percent":40.00}',
  'owner puede ver la rentabilidad del producto'
);

-- Test 4: monthly_expenses
-- month = '2026-07', category = 'Arriendo', kind = 'fixed', amount = 15
select is(
  (select row_to_json(r) from (select month, category, kind, amount from public.monthly_expenses where month = '2026-07') r)::text,
  '{"month":"2026-07","category":"Arriendo","kind":"fixed","amount":15.00}',
  'owner puede ver los gastos mensuales'
);

-- Test 5: caso borde — mes 2026-08 solo tiene gasto (sin ventas). monthly_pnl y cash_flow
-- deben incluir el mes igual (FULL OUTER JOIN), con income/cash_in en 0, no omitirlo.
select is(
  (select row_to_json(r) from (select month, income, cogs, expenses, utility from public.monthly_pnl where month = '2026-08') r)::text,
  '{"month":"2026-08","income":0.00,"cogs":0.00,"expenses":8.00,"utility":-8.00}',
  'monthly_pnl incluye un mes sin ventas pero con gastos (FULL OUTER JOIN)'
);

select is(
  (select row_to_json(r) from (select month, cash_in, cash_out, net_cash from public.cash_flow where month = '2026-08') r)::text,
  '{"month":"2026-08","cash_in":0.00,"cash_out":8.00,"net_cash":-8.00}',
  'cash_flow incluye un mes sin cobros pero con gastos (FULL OUTER JOIN)'
);

-- Test 6: caso borde — venta con descuento del 100% no revienta la division en margin_percent
select is(
  (select row_to_json(r) from (select product_id, net_income, total_cost, margin_percent from public.product_profitability where product_id = '20000000-0000-0000-0000-00000000000b') r)::text,
  '{"product_id":"20000000-0000-0000-0000-00000000000b","net_income":0.00,"total_cost":20.00,"margin_percent":0.00}',
  'product_profitability no revienta con ingreso neto 0 (division por cero controlada)'
);

-- Test 7: isolation B no ve A (las 4 vistas)
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is(
  (select count(*)::int from public.monthly_pnl),
  0,
  'owner de otro tenant no ve el P&L'
);

select is(
  (select count(*)::int from public.cash_flow),
  0,
  'owner de otro tenant no ve el flujo de caja'
);

select is(
  (select count(*)::int from public.product_profitability),
  0,
  'owner de otro tenant no ve la rentabilidad de productos'
);

select is(
  (select count(*)::int from public.monthly_expenses),
  0,
  'owner de otro tenant no ve los gastos mensuales'
);

-- Test 8: member no ve finanzas (las 4 vistas)
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';

select is(
  (select count(*)::int from public.monthly_pnl),
  0,
  'member no ve el P&L (cero filas por RLS impuesta)'
);

select is(
  (select count(*)::int from public.cash_flow),
  0,
  'member no ve el flujo de caja (cero filas por RLS impuesta)'
);

select is(
  (select count(*)::int from public.product_profitability),
  0,
  'member no ve la rentabilidad de productos (cero filas por RLS impuesta)'
);

select is(
  (select count(*)::int from public.monthly_expenses),
  0,
  'member no ve los gastos mensuales (cero filas por RLS impuesta)'
);

select * from finish();
rollback;
