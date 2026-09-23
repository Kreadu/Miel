begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

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

-- Bodegas
insert into public.warehouses (id, tenant_id, name, created_by) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'Bodega A', '00000000-0000-0000-0000-00000000000a');

-- Productos
insert into public.products (id, tenant_id, sku, name, kind, cost, created_by) values
  ('30000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'SKU-01', 'Prod A', 'resale', 10, '00000000-0000-0000-0000-00000000000a');

-- Stock inicial (Genera valor de inventario) -> 10 qty * 10 cost = 100
insert into public.stock_movements (tenant_id, warehouse_id, product_id, kind, qty, unit_cost, created_by) values
  ('10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-00000000000a', 'in', 10, 10, '00000000-0000-0000-0000-00000000000a');

-- Clientes y Ventas (Para CxC y Ventas del Mes)
insert into public.customers (id, tenant_id, doc_type, doc_number, name, created_by) values
  ('40000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'nit', '123', 'Cliente A', '00000000-0000-0000-0000-00000000000a');

-- Venta entregada HOY. Subtotal: 200, Tax: 0, Total: 200. Costo de venta: 2 * 10 = 20.
-- Genera Ingreso = 200, COGS = 20 -> Utilidad bruta = 180.
-- Genera CxC de 200 (sin pagos).
insert into public.sales (id, tenant_id, customer_id, status, issued_at, subtotal, tax, total, receipt_number, created_by) values
  ('50000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-00000000000a', 'delivered', now(), 200, 0, 200, 1, '00000000-0000-0000-0000-00000000000a');
insert into public.sale_items (sale_id, tenant_id, product_id, qty, unit_price, discount, unit_cost, tax_rate) values
  ('50000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-00000000000a', 2, 100, 0, 10, 0);
-- Sale stock movement para la venta
insert into public.stock_movements (tenant_id, warehouse_id, product_id, kind, qty, unit_cost, ref_type, ref_id, created_by) values
  ('10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-00000000000a', 'out', -2, 10, 'sale', '50000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a');
-- Stock actual = 8. Valor de inventario = 8 * 10 = 80.

-- Proveedores y Compras (Para CxP)
insert into public.suppliers (id, tenant_id, nit, name, created_by) values
  ('60000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '456', 'Prov A', '00000000-0000-0000-0000-00000000000a');

-- Compra recibida HOY. Subtotal: 50, Tax: 0, Total: 50. CxP = 50.
insert into public.purchases (id, tenant_id, supplier_id, status, subtotal, tax, total, created_by) values
  ('70000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '60000000-0000-0000-0000-00000000000a', 'received', 50, 0, 50, '00000000-0000-0000-0000-00000000000a');

-- Gastos del mes para utilidad neta. Gasto fijo de 30.
-- Utilidad bruta = 180. Gastos = 30. Utilidad neta = 150.
insert into public.expenses (id, tenant_id, kind, category, description, amount, paid_at, method, created_by) values
  ('80000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'fixed', 'Arriendo', 'Arriendo actual', 30, now(), 'transfer', '00000000-0000-0000-0000-00000000000a');

-- Simular al usuario owner (A)
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

-- Test 1: Cálculos precisos en la vista dashboard_metrics para owner A
-- current_month_sales = 200
-- current_month_utility = 150
-- inventory_value = 80
-- total_receivable = 200
-- total_payable = 50
select is(
  (select row_to_json(r) from (select current_month_sales, current_month_utility, inventory_value, total_receivable, total_payable from public.dashboard_metrics) r)::text,
  '{"current_month_sales":200.00,"current_month_utility":150.00,"inventory_value":80.00,"total_receivable":200.00,"total_payable":50.00}',
  'owner A puede ver las métricas consolidadas del dashboard correctamente'
);

-- Simular owner de otro tenant (B)
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

-- Test 2: Aislamiento para owner B (debe retornar valores en 0 o vacío, no ver A)
select is(
  (select row_to_json(r) from (select current_month_sales, current_month_utility, inventory_value, total_receivable, total_payable from public.dashboard_metrics where tenant_id = '10000000-0000-0000-0000-00000000000a') r)::text,
  null,
  'owner B no ve las métricas de owner A (aislamiento de tenant)'
);

-- Simular member del tenant A
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';

-- Test 3: RLS para member
select is(
  (select count(*)::int from public.dashboard_metrics),
  0,
  'member no ve el dashboard_metrics (prohibición por RLS)'
);

-- Test 4: empty state (crear un tenant C nuevo sin info)
reset role;
insert into public.tenants (id, name, currency) values ('10000000-0000-0000-0000-00000000000c', 'Tenant C', 'COP');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000d', 'empty@test.local');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-00000000000d', '10000000-0000-0000-0000-00000000000c', 'owner', '00000000-0000-0000-0000-00000000000d');

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000000d", "role": "authenticated"}';

select is(
  (select row_to_json(r) from (select current_month_sales, current_month_utility, inventory_value, total_receivable, total_payable from public.dashboard_metrics) r)::text,
  '{"current_month_sales":0.00,"current_month_utility":0.00,"inventory_value":0.00,"total_receivable":0.00,"total_payable":0.00}',
  'owner de tenant vacío ve todas las métricas en 0'
);

select * from finish();
rollback;
