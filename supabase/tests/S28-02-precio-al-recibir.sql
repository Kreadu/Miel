-- S28-02 — Al recibir con otro costo, el precio de venta mantiene el mismo % sobre el costo (o el
-- que escriba el dueño) y queda el historial de precios por proveedor (vista supplier_price_history).
-- Ver specs/S28-02-precio-de-venta-e-historial-proveedor.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000028201', 'owner@test.local'),
  ('00000000-0000-0000-0000-000000028202', 'member@test.local'),
  ('00000000-0000-0000-0000-000000028203', 'owner-b@test.local');
insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-000000028201', 'A'),
  ('10000000-0000-0000-0000-000000028202', 'B');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000028201', '10000000-0000-0000-0000-000000028201', 'owner', '00000000-0000-0000-0000-000000028201'),
  ('00000000-0000-0000-0000-000000028202', '10000000-0000-0000-0000-000000028201', 'member', '00000000-0000-0000-0000-000000028201'),
  ('00000000-0000-0000-0000-000000028203', '10000000-0000-0000-0000-000000028202', 'owner', '00000000-0000-0000-0000-000000028203');
insert into public.suppliers (id, tenant_id, name, created_by) values
  ('20000000-0000-0000-0000-000000028201', '10000000-0000-0000-0000-000000028201', 'X', '00000000-0000-0000-0000-000000028201'),
  ('20000000-0000-0000-0000-000000028202', '10000000-0000-0000-0000-000000028201', 'Y', '00000000-0000-0000-0000-000000028201');
insert into public.products (id, tenant_id, sku, name, cost, price, created_by) values
  ('30000000-0000-0000-0000-000000028201', '10000000-0000-0000-0000-000000028201', 'A', 'Miel', 1000, 1500, '00000000-0000-0000-0000-000000028201'),
  ('30000000-0000-0000-0000-000000028202', '10000000-0000-0000-0000-000000028201', 'Z', 'Sin costo', 0, 800, '00000000-0000-0000-0000-000000028201');
insert into public.warehouses (id, tenant_id, name, created_by) values
  ('40000000-0000-0000-0000-000000028201', '10000000-0000-0000-0000-000000028201', 'W', '00000000-0000-0000-0000-000000028201');
insert into public.stock_movements (tenant_id, product_id, warehouse_id, kind, qty, unit_cost, created_by) values
  ('10000000-0000-0000-0000-000000028201', '30000000-0000-0000-0000-000000028201', '40000000-0000-0000-0000-000000028201', 'in', 10, 1000, '00000000-0000-0000-0000-000000028201');
-- X1: A a 1.000 (igual). X2: A a 1.200 (+20 %). Y: A a 1.100. X3: A a 2.200 (la recibe el miembro). Z: costo 0.
insert into public.purchases (id, tenant_id, supplier_id, status, issued_at, created_by) values
  ('50000000-0000-0000-0000-000000028201', '10000000-0000-0000-0000-000000028201', '20000000-0000-0000-0000-000000028201', 'ordered', now(), '00000000-0000-0000-0000-000000028201'),
  ('50000000-0000-0000-0000-000000028202', '10000000-0000-0000-0000-000000028201', '20000000-0000-0000-0000-000000028201', 'ordered', now(), '00000000-0000-0000-0000-000000028201'),
  ('50000000-0000-0000-0000-000000028203', '10000000-0000-0000-0000-000000028201', '20000000-0000-0000-0000-000000028202', 'ordered', now(), '00000000-0000-0000-0000-000000028201'),
  ('50000000-0000-0000-0000-000000028204', '10000000-0000-0000-0000-000000028201', '20000000-0000-0000-0000-000000028201', 'ordered', now(), '00000000-0000-0000-0000-000000028201');
insert into public.purchase_items (id, tenant_id, purchase_id, product_id, qty, unit_cost, tax_rate) values
  ('51000000-0000-0000-0000-000000028201', '10000000-0000-0000-0000-000000028201', '50000000-0000-0000-0000-000000028201', '30000000-0000-0000-0000-000000028201', 10, 1000, 0),
  ('51000000-0000-0000-0000-000000028202', '10000000-0000-0000-0000-000000028201', '50000000-0000-0000-0000-000000028202', '30000000-0000-0000-0000-000000028201', 10, 1200, 0),
  ('51000000-0000-0000-0000-000000028203', '10000000-0000-0000-0000-000000028201', '50000000-0000-0000-0000-000000028203', '30000000-0000-0000-0000-000000028201', 5, 1100, 0),
  ('51000000-0000-0000-0000-000000028204', '10000000-0000-0000-0000-000000028201', '50000000-0000-0000-0000-000000028204', '30000000-0000-0000-0000-000000028201', 1, 2200, 0),
  ('51000000-0000-0000-0000-000000028205', '10000000-0000-0000-0000-000000028201', '50000000-0000-0000-0000-000000028204', '30000000-0000-0000-0000-000000028202', 1, 500, 0);

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000028201", "role": "authenticated"}';
create temp table t_ids (k text primary key, id uuid) on commit drop;
grant all on t_ids to authenticated;

insert into t_ids select 'x1', public.create_purchase_invoice('50000000-0000-0000-0000-000000028201', 'X-1', current_date - 10, null, null, 10000, 0, 10000, '40000000-0000-0000-0000-000000028201', null);
insert into t_ids select 'x2', public.create_purchase_invoice('50000000-0000-0000-0000-000000028202', 'X-2', current_date - 5, null, null, 12000, 0, 12000, '40000000-0000-0000-0000-000000028201', null);
insert into t_ids select 'y1', public.create_purchase_invoice('50000000-0000-0000-0000-000000028203', 'Y-1', current_date - 3, null, null, 5500, 0, 5500, '40000000-0000-0000-0000-000000028201', null);
insert into t_ids select 'x3', public.create_purchase_invoice('50000000-0000-0000-0000-000000028204', 'X-3', current_date, null, null, 2700, 0, 2700, '40000000-0000-0000-0000-000000028201', null);

-- Mismo costo: el precio no se toca.
insert into t_ids select 'lx1', public.receive_purchase_line((select id from t_ids where k = 'x1'), '51000000-0000-0000-0000-000000028201', 10, 1000, 0);
select is((select price from public.products where id = '30000000-0000-0000-0000-000000028201'),
  1500.00::numeric, 'Costo igual: el precio no cambia');

-- C1: 10 a 1.200 sobre 20 a 1.000 → costo 1.066,67; precio 1.500 × 1.066,67 / 1.000 = 1.600.
insert into t_ids select 'lx2', public.receive_purchase_line((select id from t_ids where k = 'x2'), '51000000-0000-0000-0000-000000028202', 10, 1200, 0);
select is((select cost from public.products where id = '30000000-0000-0000-0000-000000028201'),
  1066.67::numeric, 'C1: costo promedio');
select is((select price from public.products where id = '30000000-0000-0000-0000-000000028201'),
  1600.00::numeric, 'C1: el precio conserva el mismo % y se redondea al peso');

-- C2: el dueño escribe el precio.
select throws_ok(
  format($$select public.receive_purchase_line('%s', '51000000-0000-0000-0000-000000028203', 5, 1100, 0, -1)$$, (select id from t_ids where k = 'y1')),
  'P0001', 'price_invalid', 'C2: precio negativo');
insert into t_ids select 'ly1', public.receive_purchase_line((select id from t_ids where k = 'y1'), '51000000-0000-0000-0000-000000028203', 5, 1100, 0, 1700);
select is((select price from public.products where id = '30000000-0000-0000-0000-000000028201'),
  1700.00::numeric, 'C2: queda el precio que escribió el dueño');

-- C2: costo anterior 0 → el precio no cambia.
select public.receive_purchase_line((select id from t_ids where k = 'x3'), '51000000-0000-0000-0000-000000028205', 1, 500, 0);
select is((select price from public.products where id = '30000000-0000-0000-0000-000000028202'),
  800.00::numeric, 'C2: sin costo anterior, el precio no se toca');

-- P6: el miembro recibe al costo de la orden; su precio se ignora y se aplica el mismo %.
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000028202", "role": "authenticated"}';
select public.receive_purchase_line((select id from t_ids where k = 'x3'), '51000000-0000-0000-0000-000000028204', 1, 1, 0, 1);
select is((select count(*)::int from public.supplier_price_history), 0, 'C3: el miembro no ve el historial');
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000028201", "role": "authenticated"}';
select ok((select price > 1700 from public.products where id = '30000000-0000-0000-0000-000000028201'),
  'P6: con el costo de la orden (2.200) el precio sube con el mismo %; el del miembro se ignora');

-- C3: historial por proveedor y producto, con variación.
select is((select count(*)::int from public.supplier_price_history where product_id = '30000000-0000-0000-0000-000000028201'),
  4, 'C3: cuatro compras de A (X, X, Y, X)');
select is((select change_percent from public.supplier_price_history where invoice_number = 'X-2'),
  20.00::numeric, 'C3: X pasó de 1.000 a 1.200 (+20 %)');

-- C4: anular saca la línea del historial y no toca el precio.
create temp table t_price on commit drop as select price from public.products where id = '30000000-0000-0000-0000-000000028201';
select public.void_purchase_receipt_line((select id from t_ids where k = 'ly1'));
select is((select count(*)::int from public.supplier_price_history where supplier_id = '20000000-0000-0000-0000-000000028202'),
  0, 'C4: la línea anulada sale del historial');
select is((select price from public.products where id = '30000000-0000-0000-0000-000000028201'),
  (select price from t_price), 'C4: anular no cambia el precio de venta');

-- Otra empresa no ve nada.
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000028203", "role": "authenticated"}';
select is((select count(*)::int from public.supplier_price_history), 0, 'C3: otra empresa no ve el historial');

select * from finish();
rollback;
