-- S26-11 — Orden de compra con cantidades por bodega: ítems con warehouse_id, recepción directa a
-- la bodega de cada ítem (factura sin bodega) y anulación desde la bodega del movimiento.
-- Ver specs/S26-11-cantidades-por-bodega.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000026b01', 'duena-s2611@test.local'),
  ('00000000-0000-0000-0000-000000026b02', 'ajeno-s2611@test.local');
insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-000000026b01', 'A'),
  ('10000000-0000-0000-0000-000000026b02', 'B');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000026b01', '10000000-0000-0000-0000-000000026b01', 'owner', '00000000-0000-0000-0000-000000026b01'),
  ('00000000-0000-0000-0000-000000026b02', '10000000-0000-0000-0000-000000026b02', 'owner', '00000000-0000-0000-0000-000000026b02');
insert into public.workers (tenant_id, full_name, doc_number, user_id, created_by) values
  ('10000000-0000-0000-0000-000000026b01', 'Dueña', '1', '00000000-0000-0000-0000-000000026b01', '00000000-0000-0000-0000-000000026b01');
insert into public.suppliers (id, tenant_id, name, created_by) values
  ('20000000-0000-0000-0000-000000026b01', '10000000-0000-0000-0000-000000026b01', 'P', '00000000-0000-0000-0000-000000026b01');
insert into public.products (id, tenant_id, sku, name, cost, created_by) values
  ('30000000-0000-0000-0000-000000026b01', '10000000-0000-0000-0000-000000026b01', 'M', 'Miel', 100, '00000000-0000-0000-0000-000000026b01');
insert into public.warehouses (id, tenant_id, name, active, created_by) values
  ('40000000-0000-0000-0000-000000026b01', '10000000-0000-0000-0000-000000026b01', 'Principal', true, '00000000-0000-0000-0000-000000026b01'),
  ('40000000-0000-0000-0000-000000026b02', '10000000-0000-0000-0000-000000026b01', 'Norte', true, '00000000-0000-0000-0000-000000026b01'),
  ('40000000-0000-0000-0000-000000026b03', '10000000-0000-0000-0000-000000026b01', 'Cerrada', false, '00000000-0000-0000-0000-000000026b01'),
  ('40000000-0000-0000-0000-000000026b04', '10000000-0000-0000-0000-000000026b02', 'Ajena', true, '00000000-0000-0000-0000-000000026b02');
-- Orden vieja (sin bodega en el ítem) para el caso de la factura sin bodega.
insert into public.purchases (id, tenant_id, supplier_id, status, issued_at, created_by) values
  ('50000000-0000-0000-0000-000000026b09', '10000000-0000-0000-0000-000000026b01', '20000000-0000-0000-0000-000000026b01', 'ordered', now(), '00000000-0000-0000-0000-000000026b01');
insert into public.purchase_items (tenant_id, purchase_id, product_id, qty, unit_cost) values
  ('10000000-0000-0000-0000-000000026b01', '50000000-0000-0000-0000-000000026b09', '30000000-0000-0000-0000-000000026b01', 1, 100);

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000026b01", "role": "authenticated"}';
create temp table t (k text primary key, id uuid) on commit drop;
grant all on t to authenticated;

-- C1: una orden, dos bodegas
insert into t select 'oc', public.create_purchase('20000000-0000-0000-0000-000000026b01', 'ordered',
  '[{"product_id": "30000000-0000-0000-0000-000000026b01", "warehouse_id": "40000000-0000-0000-0000-000000026b01", "qty": 20, "unit_cost": 100},
    {"product_id": "30000000-0000-0000-0000-000000026b01", "warehouse_id": "40000000-0000-0000-0000-000000026b02", "qty": 10, "unit_cost": 100}]'::jsonb, null);
select results_eq(
  format($$select w.name, pi.qty from public.purchase_items pi join public.warehouses w on w.id = pi.warehouse_id
           where pi.purchase_id = '%s' order by pi.qty desc$$, (select id from t where k = 'oc')),
  $$values ('Principal'::text, 20.000::numeric), ('Norte'::text, 10.000::numeric)$$,
  'C1: un ítem por bodega');
select is((select total from public.purchases where id = (select id from t where k = 'oc')),
  3000.00::numeric, 'C1: el total suma las dos bodegas');

-- C2: bodega ajena o inactiva
select throws_ok(
  $$select public.create_purchase('20000000-0000-0000-0000-000000026b01', 'ordered',
      '[{"product_id": "30000000-0000-0000-0000-000000026b01", "warehouse_id": "40000000-0000-0000-0000-000000026b04", "qty": 1, "unit_cost": 1}]'::jsonb, null)$$,
  'P0001', 'warehouse_invalid', 'C2: bodega de otra empresa');
select throws_ok(
  $$select public.create_purchase('20000000-0000-0000-0000-000000026b01', 'ordered',
      '[{"product_id": "30000000-0000-0000-0000-000000026b01", "warehouse_id": "40000000-0000-0000-0000-000000026b03", "qty": 1, "unit_cost": 1}]'::jsonb, null)$$,
  'P0001', 'warehouse_invalid', 'C2: bodega inactiva');

-- C3: factura sin bodega; cada línea entra en su bodega
insert into t select 'fe', public.create_purchase_invoice((select id from t where k = 'oc'), 'FE-1', current_date, null, null,
  3000, 0, 3000, null, null);
select public.receive_purchase_line((select id from t where k = 'fe'), pi.id, pi.qty, 100, 0)
from public.purchase_items pi where pi.purchase_id = (select id from t where k = 'oc');
select is((select sum(qty) from public.stock_movements where warehouse_id = '40000000-0000-0000-0000-000000026b01'),
  20.000::numeric, 'C3: 20 entran a Principal');
select is((select sum(qty) from public.stock_movements where warehouse_id = '40000000-0000-0000-0000-000000026b02'),
  10.000::numeric, 'C3: 10 entran a Norte');
select is((select status from public.purchases where id = (select id from t where k = 'oc')),
  'received', 'C3: la orden queda recibida');
select throws_ok(
  $$select public.create_purchase_invoice('50000000-0000-0000-0000-000000026b09', 'FE-9', current_date, null, null,
      100, 0, 100, null, null)$$,
  'P0001', 'warehouse_invalid', 'C3: orden vieja sin bodega en el ítem → la factura necesita bodega');

-- C4: anular la línea de Norte saca el stock de Norte
select public.void_purchase_receipt_line(l.id)
from public.purchase_receipt_lines l join public.purchase_items pi on pi.id = l.purchase_item_id
where pi.warehouse_id = '40000000-0000-0000-0000-000000026b02';
select is((select sum(qty) from public.stock_movements where warehouse_id = '40000000-0000-0000-0000-000000026b02'),
  0.000::numeric, 'C4: sale de Norte');
select is((select sum(qty) from public.stock_movements where warehouse_id = '40000000-0000-0000-0000-000000026b01'),
  20.000::numeric, 'C4: Principal no se toca');

-- update_purchase también valida la bodega
insert into t select 'bor', public.create_purchase('20000000-0000-0000-0000-000000026b01', 'draft',
  '[{"product_id": "30000000-0000-0000-0000-000000026b01", "warehouse_id": "40000000-0000-0000-0000-000000026b01", "qty": 1, "unit_cost": 1}]'::jsonb, null);
select throws_ok(
  format($$select public.update_purchase('%s', '20000000-0000-0000-0000-000000026b01',
      '[{"product_id": "30000000-0000-0000-0000-000000026b01", "warehouse_id": "40000000-0000-0000-0000-000000026b04", "qty": 1, "unit_cost": 1}]'::jsonb, null)$$,
    (select id from t where k = 'bor')),
  'P0001', 'warehouse_invalid', 'C2: al editar, bodega ajena se rechaza');

select * from finish();
rollback;
