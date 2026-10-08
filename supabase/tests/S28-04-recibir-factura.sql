-- S28-04 — receive_purchase_invoice: factura + líneas en un paso, totales calculados de lo que llegó
-- y reparto por bodega. Ver specs/S28-04-recibir-factura-en-un-formulario.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000028401', 'duena-s2804@test.local'),
  ('00000000-0000-0000-0000-000000028402', 'miembro-s2804@test.local'),
  ('00000000-0000-0000-0000-000000028403', 'ajeno-s2804@test.local');
insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-000000028401', 'A'), ('10000000-0000-0000-0000-000000028402', 'B');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000028401', '10000000-0000-0000-0000-000000028401', 'owner', '00000000-0000-0000-0000-000000028401'),
  ('00000000-0000-0000-0000-000000028402', '10000000-0000-0000-0000-000000028401', 'member', '00000000-0000-0000-0000-000000028401'),
  ('00000000-0000-0000-0000-000000028403', '10000000-0000-0000-0000-000000028402', 'owner', '00000000-0000-0000-0000-000000028403');
insert into public.suppliers (id, tenant_id, name, created_by) values
  ('20000000-0000-0000-0000-000000028401', '10000000-0000-0000-0000-000000028401', 'P', '00000000-0000-0000-0000-000000028401');
insert into public.products (id, tenant_id, sku, name, cost, price, created_by) values
  ('30000000-0000-0000-0000-000000028401', '10000000-0000-0000-0000-000000028401', 'A', 'A', 1000, 1500, '00000000-0000-0000-0000-000000028401'),
  ('30000000-0000-0000-0000-000000028402', '10000000-0000-0000-0000-000000028401', 'B', 'B', 2000, 3000, '00000000-0000-0000-0000-000000028401');
insert into public.warehouses (id, tenant_id, name, created_by) values
  ('40000000-0000-0000-0000-000000028401', '10000000-0000-0000-0000-000000028401', 'Principal', '00000000-0000-0000-0000-000000028401'),
  ('40000000-0000-0000-0000-000000028402', '10000000-0000-0000-0000-000000028401', 'Norte', '00000000-0000-0000-0000-000000028401'),
  ('40000000-0000-0000-0000-000000028403', '10000000-0000-0000-0000-000000028402', 'Ajena', '00000000-0000-0000-0000-000000028403');
insert into public.purchases (id, tenant_id, supplier_id, status, issued_at, total, created_by) values
  ('50000000-0000-0000-0000-000000028401', '10000000-0000-0000-0000-000000028401', '20000000-0000-0000-0000-000000028401', 'ordered', now(), 21900, '00000000-0000-0000-0000-000000028401');
insert into public.purchase_items (id, tenant_id, purchase_id, product_id, warehouse_id, qty, unit_cost, tax_rate) values
  ('51000000-0000-0000-0000-000000028401', '10000000-0000-0000-0000-000000028401', '50000000-0000-0000-0000-000000028401', '30000000-0000-0000-0000-000000028401', '40000000-0000-0000-0000-000000028401', 10, 1000, 19),
  ('51000000-0000-0000-0000-000000028402', '10000000-0000-0000-0000-000000028401', '50000000-0000-0000-0000-000000028401', '30000000-0000-0000-0000-000000028402', '40000000-0000-0000-0000-000000028402', 5, 2000, 0);

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000028401", "role": "authenticated"}';
create temp table t (id uuid) on commit drop;
grant all on t to authenticated;

-- C2: sin líneas con cantidad
select throws_ok(
  $$select public.receive_purchase_invoice('50000000-0000-0000-0000-000000028401', 'FE-1', current_date, null, null, null,
      '[{"purchase_item_id": "51000000-0000-0000-0000-000000028402", "warehouse_id": "40000000-0000-0000-0000-000000028402", "qty": 0}]'::jsonb)$$,
  'P0001', 'lines_required', 'C2: sin productos recibidos no hay factura');
-- C2: el reparto suma más de lo pendiente → nada queda
select throws_ok(
  $$select public.receive_purchase_invoice('50000000-0000-0000-0000-000000028401', 'FE-1', current_date, null, null, null,
      '[{"purchase_item_id": "51000000-0000-0000-0000-000000028401", "warehouse_id": "40000000-0000-0000-0000-000000028401", "qty": 8, "unit_cost": 1000, "tax_rate": 19},
        {"purchase_item_id": "51000000-0000-0000-0000-000000028401", "warehouse_id": "40000000-0000-0000-0000-000000028402", "qty": 3, "unit_cost": 1000, "tax_rate": 19}]'::jsonb)$$,
  'P0001', 'qty_exceeds_pending', 'C2: el reparto no puede pasar de lo pendiente');
select throws_ok(
  $$select public.receive_purchase_invoice('50000000-0000-0000-0000-000000028401', 'FE-1', current_date, null, null, null,
      '[{"purchase_item_id": "51000000-0000-0000-0000-000000028401", "warehouse_id": "40000000-0000-0000-0000-000000028403", "qty": 1, "unit_cost": 1000, "tax_rate": 19}]'::jsonb)$$,
  'P0001', 'warehouse_invalid', 'C2: bodega de otra empresa');
reset role;
select is((select count(*)::int from public.purchase_invoices), 0, 'C2: los rechazos no dejan factura');
select is((select count(*)::int from public.stock_movements), 0, 'C2: ni stock');

-- C1: llegan 6 A a 1.200 (4 Principal + 2 Norte) y 0 B
set local role authenticated;
insert into t select public.receive_purchase_invoice('50000000-0000-0000-0000-000000028401', 'FE-1', current_date, current_date + 30, 'cufe', null,
  '[{"purchase_item_id": "51000000-0000-0000-0000-000000028401", "warehouse_id": "40000000-0000-0000-0000-000000028401", "qty": 4, "unit_cost": 1200, "tax_rate": 19},
    {"purchase_item_id": "51000000-0000-0000-0000-000000028401", "warehouse_id": "40000000-0000-0000-0000-000000028402", "qty": 2, "unit_cost": 1200, "tax_rate": 19},
    {"purchase_item_id": "51000000-0000-0000-0000-000000028402", "warehouse_id": "40000000-0000-0000-0000-000000028402", "qty": 0}]'::jsonb);
select results_eq(
  $$select subtotal, tax, total from public.purchase_invoices where id = (select id from t)$$,
  $$values (7200.00::numeric, 1368.00::numeric, 8568.00::numeric)$$,
  'C1: totales calculados de lo que llegó');
select is((select sum(qty) from public.stock_movements where warehouse_id = '40000000-0000-0000-0000-000000028401'), 4.000::numeric, 'C1: 4 a Principal');
select is((select sum(qty) from public.stock_movements where warehouse_id = '40000000-0000-0000-0000-000000028402'), 2.000::numeric, 'C1: 2 a Norte');
select is((select received_qty from public.purchase_items where id = '51000000-0000-0000-0000-000000028401'), 6.000::numeric, 'C1: A recibido 6 de 10');
select is((select status from public.purchases where id = '50000000-0000-0000-0000-000000028401'), 'partially_received', 'C1: orden parcial');
select is((select invoiced_total from public.purchases where id = '50000000-0000-0000-0000-000000028401'), 8568.00::numeric, 'C1: la deuda es la factura');
select throws_ok(
  $$select public.receive_purchase_invoice('50000000-0000-0000-0000-000000028401', 'fe-1', current_date, null, null, null,
      '[{"purchase_item_id": "51000000-0000-0000-0000-000000028402", "warehouse_id": "40000000-0000-0000-0000-000000028402", "qty": 1, "unit_cost": 2000, "tax_rate": 0}]'::jsonb)$$,
  'P0001', 'invoice_number_taken', 'C2: número repetido');

-- C3: el miembro recibe al costo de la orden
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000028402", "role": "authenticated"}';
select public.receive_purchase_invoice('50000000-0000-0000-0000-000000028401', 'FE-2', current_date, null, null, null,
  '[{"purchase_item_id": "51000000-0000-0000-0000-000000028402", "warehouse_id": "40000000-0000-0000-0000-000000028402", "qty": 5, "unit_cost": 1, "tax_rate": 50}]'::jsonb);
reset role;
select results_eq(
  $$select subtotal, tax from public.purchase_invoices where number = 'FE-2'$$,
  $$values (10000.00::numeric, 0.00::numeric)$$,
  'C3: con el costo y el IVA de la orden');

select * from finish();
rollback;
