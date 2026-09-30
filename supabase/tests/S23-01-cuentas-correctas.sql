-- S23-01 — Cuentas correctas: costo sin IVA y promedio, precio desde el producto, redondeo por
-- línea, anulación de venta, envío como ingreso, gastos sin IVA descontable.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000231a01', 'owner-s2301@test.local'),
  ('00000000-0000-0000-0000-000000231a02', 'member-s2301@test.local');
insert into public.tenants (id, name) values ('10000000-0000-0000-0000-000000231a01', 'Tenant S23-01');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000231a01', '10000000-0000-0000-0000-000000231a01', 'owner',
   '00000000-0000-0000-0000-000000231a01'),
  ('00000000-0000-0000-0000-000000231a02', '10000000-0000-0000-0000-000000231a01', 'member',
   '00000000-0000-0000-0000-000000231a01');
insert into public.warehouses (id, tenant_id, name, created_by) values
  ('30000000-0000-0000-0000-000000231a01', '10000000-0000-0000-0000-000000231a01', 'Bodega',
   '00000000-0000-0000-0000-000000231a01');
insert into public.products (id, tenant_id, sku, name, cost, price, tax_rate, discount_percent, created_by) values
  ('40000000-0000-0000-0000-000000231a01', '10000000-0000-0000-0000-000000231a01', 'S2301-A',
   'Producto A', 0, 33.33, 19, 10, '00000000-0000-0000-0000-000000231a01');
insert into public.suppliers (id, tenant_id, name, created_by) values
  ('20000000-0000-0000-0000-000000231a01', '10000000-0000-0000-0000-000000231a01', 'Proveedor',
   '00000000-0000-0000-0000-000000231a01');
insert into public.purchases (id, tenant_id, supplier_id, status, issued_at, created_by) values
  ('50000000-0000-0000-0000-000000231a01', '10000000-0000-0000-0000-000000231a01',
   '20000000-0000-0000-0000-000000231a01', 'ordered', now(), '00000000-0000-0000-0000-000000231a01');
insert into public.purchase_items (tenant_id, purchase_id, product_id, qty, unit_cost, tax_rate) values
  ('10000000-0000-0000-0000-000000231a01', '50000000-0000-0000-0000-000000231a01',
   '40000000-0000-0000-0000-000000231a01', 10, 100, 19);
insert into public.cash_sessions (tenant_id, opened_by, opening_amount, created_by) values
  ('10000000-0000-0000-0000-000000231a01', '00000000-0000-0000-0000-000000231a01', 0,
   '00000000-0000-0000-0000-000000231a01');

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000231a01", "role": "authenticated"}';

-- === Datos fiscales por defecto ===
select is((select person_type from public.tenants where id = '10000000-0000-0000-0000-000000231a01'),
  'juridica', 'C0: empresa nace persona jurídica');
select is((select income_tax_rate from public.tenants where id = '10000000-0000-0000-0000-000000231a01'),
  35.00::numeric(5,2), 'C0: tarifa de renta 35 %');

-- === C1: la compra entra SIN IVA y el costo del producto es el promedio ===
select public.receive_purchase('50000000-0000-0000-0000-000000231a01', '30000000-0000-0000-0000-000000231a01');
select is((select unit_cost from public.stock_movements where ref_type = 'purchase'
           and ref_id = '50000000-0000-0000-0000-000000231a01'), 100::numeric,
  'C1: el kardex entra al costo del proveedor sin IVA');
select is((select cost from public.products where id = '40000000-0000-0000-0000-000000231a01'), 100::numeric,
  'C1: costo del producto = 100 (sin IVA)');

-- === C2: una entrada sin costo toma el promedio (no baja el valor) ===
select public.register_movement('40000000-0000-0000-0000-000000231a01', '30000000-0000-0000-0000-000000231a01',
  'in', 10, null, 'manual', null, null);
select is((select unit_cost from public.stock_movements where ref_type = 'manual'), 100::numeric,
  'C2: entrada sin costo toma el promedio');
select public.register_movement('40000000-0000-0000-0000-000000231a01', '30000000-0000-0000-0000-000000231a01',
  'in', 20, 130, 'manual2', null, null);
select is((select cost from public.products where id = '40000000-0000-0000-0000-000000231a01'), 115::numeric,
  'C2: costo del producto = promedio ponderado (20·100 + 20·130) / 40');

-- === C3: create_sale ignora precio/IVA/descuento del navegador y redondea por línea ===
select lives_ok($$
  select public.create_sale('10000000-0000-0000-0000-000000231a01',
    '[{"product_id": "40000000-0000-0000-0000-000000231a01", "qty": 3, "unit_price": 1, "tax_rate": 0, "discount": 0}]'::jsonb,
    null, 'S23-01', null, 'agreed', null, null, 5000)
$$, 'C3: crea la venta');
select is((select unit_price from public.sale_items si join public.sales s on s.id = si.sale_id where s.note = 'S23-01'),
  33.33::numeric, 'C3: precio del producto, no el enviado');
select is((select subtotal from public.sales where note = 'S23-01'), 89.99::numeric,
  'C3: línea = round(3·33,33 − round(9,999)) = 89,99');
select is((select tax from public.sales where note = 'S23-01'), 17.10::numeric, 'C3: IVA redondeado por línea');
select is((select total from public.sales where note = 'S23-01'), 5107.09::numeric,
  'C3: total = subtotal + IVA + envío');

-- === C4: Resultados incluye el envío; los gastos van sin IVA descontable ===
select public.confirm_sale((select id from public.sales where note = 'S23-01'), '30000000-0000-0000-0000-000000231a01');
insert into public.expenses (tenant_id, kind, category, description, amount, tax_amount, method, created_by) values
  ('10000000-0000-0000-0000-000000231a01', 'fixed', 'Arriendo', 'Local', 1190, 190, 'transfer',
   '00000000-0000-0000-0000-000000231a01');
select is((select income from public.monthly_pnl
           where month = to_char(now() at time zone 'America/Bogota', 'YYYY-MM')), 5089.99::numeric(14,2),
  'C4: Ventas = 89,99 + 5.000 de envío');
select is((select expenses from public.monthly_pnl
           where month = to_char(now() at time zone 'America/Bogota', 'YYYY-MM')), 1000::numeric(14,2),
  'C4: gasto sin IVA descontable');

-- === C5: anular — un operativo no puede; el admin devuelve stock y la caja no la cuenta ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000231a02", "role": "authenticated"}';
select throws_ok($$ select public.cancel_sale((select id from public.sales where note = 'S23-01')) $$,
  'P0001', 'permission_denied', 'C5: member no anula');

set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000231a01", "role": "authenticated"}';
select public.cancel_sale((select id from public.sales where note = 'S23-01'));
select is((select sum(qty) from public.stock_movements where product_id = '40000000-0000-0000-0000-000000231a01'),
  40::numeric, 'C5: el stock vuelve completo');
select is((select sales_count from public.cash_session_summary), 0::bigint, 'C5: la caja no cuenta la venta anulada');

select * from finish();
rollback;
