-- S28-03 — Corregir y anular facturas de proveedor (deuda según facturas activas, nunca menor a lo
-- pagado) y anular líneas sin dejar valor sobrante en el kardex.
-- Ver specs/S28-03-corregir-factura-y-anulacion-coherente.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000028301', 'owner@test.local'),
  ('00000000-0000-0000-0000-000000028302', 'member@test.local'),
  ('00000000-0000-0000-0000-000000028303', 'owner-b@test.local');
insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-000000028301', 'A'),
  ('10000000-0000-0000-0000-000000028302', 'B');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000028301', '10000000-0000-0000-0000-000000028301', 'owner', '00000000-0000-0000-0000-000000028301'),
  ('00000000-0000-0000-0000-000000028302', '10000000-0000-0000-0000-000000028301', 'member', '00000000-0000-0000-0000-000000028301'),
  ('00000000-0000-0000-0000-000000028303', '10000000-0000-0000-0000-000000028302', 'owner', '00000000-0000-0000-0000-000000028303');
insert into public.suppliers (id, tenant_id, name, created_by) values
  ('20000000-0000-0000-0000-000000028301', '10000000-0000-0000-0000-000000028301', 'P', '00000000-0000-0000-0000-000000028301');
insert into public.products (id, tenant_id, sku, name, cost, price, created_by) values
  ('30000000-0000-0000-0000-000000028301', '10000000-0000-0000-0000-000000028301', 'A', 'A', 1000, 1500, '00000000-0000-0000-0000-000000028301'),
  ('30000000-0000-0000-0000-000000028302', '10000000-0000-0000-0000-000000028301', 'B', 'B', 1000, 1500, '00000000-0000-0000-0000-000000028301'),
  ('30000000-0000-0000-0000-000000028303', '10000000-0000-0000-0000-000000028301', 'C', 'C', 1000, 1500, '00000000-0000-0000-0000-000000028301');
insert into public.warehouses (id, tenant_id, name, created_by) values
  ('40000000-0000-0000-0000-000000028301', '10000000-0000-0000-0000-000000028301', 'W', '00000000-0000-0000-0000-000000028301');
insert into public.stock_movements (tenant_id, product_id, warehouse_id, kind, qty, unit_cost, created_by) values
  ('10000000-0000-0000-0000-000000028301', '30000000-0000-0000-0000-000000028301', '40000000-0000-0000-0000-000000028301', 'in', 10, 1000, '00000000-0000-0000-0000-000000028301'),
  ('10000000-0000-0000-0000-000000028301', '30000000-0000-0000-0000-000000028302', '40000000-0000-0000-0000-000000028301', 'in', 5, 1000, '00000000-0000-0000-0000-000000028301'),
  ('10000000-0000-0000-0000-000000028301', '30000000-0000-0000-0000-000000028303', '40000000-0000-0000-0000-000000028301', 'in', 5, 1000, '00000000-0000-0000-0000-000000028301');
-- P1: factura a corregir/anular (con pago de 5.000). P2: A, B y C a 2.000 para las anulaciones.
insert into public.purchases (id, tenant_id, supplier_id, status, issued_at, total, created_by) values
  ('50000000-0000-0000-0000-000000028301', '10000000-0000-0000-0000-000000028301', '20000000-0000-0000-0000-000000028301', 'ordered', now(), 3000, '00000000-0000-0000-0000-000000028301'),
  ('50000000-0000-0000-0000-000000028302', '10000000-0000-0000-0000-000000028301', '20000000-0000-0000-0000-000000028301', 'ordered', now(), 40000, '00000000-0000-0000-0000-000000028301');
insert into public.purchase_items (id, tenant_id, purchase_id, product_id, qty, unit_cost, tax_rate) values
  ('51000000-0000-0000-0000-000000028301', '10000000-0000-0000-0000-000000028301', '50000000-0000-0000-0000-000000028301', '30000000-0000-0000-0000-000000028301', 1, 1000, 0),
  ('51000000-0000-0000-0000-000000028302', '10000000-0000-0000-0000-000000028301', '50000000-0000-0000-0000-000000028302', '30000000-0000-0000-0000-000000028301', 10, 2000, 0),
  ('51000000-0000-0000-0000-000000028303', '10000000-0000-0000-0000-000000028301', '50000000-0000-0000-0000-000000028302', '30000000-0000-0000-0000-000000028302', 5, 2000, 0),
  ('51000000-0000-0000-0000-000000028304', '10000000-0000-0000-0000-000000028301', '50000000-0000-0000-0000-000000028302', '30000000-0000-0000-0000-000000028303', 5, 2000, 0);

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000028301", "role": "authenticated"}';
create temp table t_ids (k text primary key, id uuid) on commit drop;
grant all on t_ids to authenticated;

insert into t_ids select 'fe123', public.create_purchase_invoice('50000000-0000-0000-0000-000000028301', 'FE-123', current_date, null, null, 7200, 1368, 8568, '40000000-0000-0000-0000-000000028301', null);
select public.register_supplier_payment('20000000-0000-0000-0000-000000028301', '50000000-0000-0000-0000-000000028301', 5000, 'cash', now(), null);

-- C1: corregir número e IVA
select lives_ok(
  format($$select public.update_purchase_invoice('%s', 'FE-128', current_date, current_date + 30, 'cufe', 7200, 1400, 8600, null)$$, (select id from t_ids where k = 'fe123')),
  'C1: el dueño corrige la factura');
select results_eq(
  format($$select number, total, due_on = current_date + 30 from public.purchase_invoices where id = '%s'$$, (select id from t_ids where k = 'fe123')),
  $$values ('FE-128'::text, 8600.00::numeric, true)$$,
  'C1: queda con el número, el total y el vencimiento nuevos');
select is((select invoiced_total from public.purchases where id = '50000000-0000-0000-0000-000000028301'),
  8600.00::numeric, 'C1: la deuda de la orden se corrige');
select is((select total_purchases from public.supplier_balances where supplier_id = '20000000-0000-0000-0000-000000028301'),
  8600.00 + 40000, 'C1: y cuentas por pagar');
select throws_ok(
  format($$select public.update_purchase_invoice('%s', 'FE-128', current_date, null, null, 100, 0, 101, null)$$, (select id from t_ids where k = 'fe123')),
  'P0001', 'invoice_totals_invalid', 'C1: mismas validaciones de totales');

-- C3: no por debajo de lo pagado
select throws_ok(
  format($$select public.update_purchase_invoice('%s', 'FE-128', current_date, null, null, 4000, 0, 4000, null)$$, (select id from t_ids where k = 'fe123')),
  'P0001', 'invoice_below_payments', 'C3: la deuda no queda por debajo de lo pagado');
select is((select total from public.purchase_invoices where id = (select id from t_ids where k = 'fe123')),
  8600.00::numeric, 'C3: el rechazo no cambia nada');
select throws_ok(
  format($$select public.void_purchase_invoice('%s')$$, (select id from t_ids where k = 'fe123')),
  'P0001', 'invoice_below_payments', 'C3: anularla dejaría la deuda en el total de la orden (3.000), menos que lo pagado');

-- Miembro y otra empresa
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000028302", "role": "authenticated"}';
select throws_ok(
  format($$select public.update_purchase_invoice('%s', 'X', current_date, null, null, 1, 0, 1, null)$$, (select id from t_ids where k = 'fe123')),
  'P0001', 'permission_denied', 'C1: un miembro no corrige');
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000028303", "role": "authenticated"}';
select throws_ok(
  format($$select public.void_purchase_invoice('%s')$$, (select id from t_ids where k = 'fe123')),
  'P0001', 'invoice_not_found', 'C1: otra empresa no la toca');
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000028301", "role": "authenticated"}';

-- C2: anular una factura sin líneas (P2) y reutilizar su número
insert into t_ids select 'fe200', public.create_purchase_invoice('50000000-0000-0000-0000-000000028302', 'FE-200', current_date, null, null, 1, 0, 1, '40000000-0000-0000-0000-000000028301', null);
select lives_ok(format($$select public.void_purchase_invoice('%s')$$, (select id from t_ids where k = 'fe200')), 'C2: anula la factura sin líneas');
select ok((select invoiced_total is null from public.purchases where id = '50000000-0000-0000-0000-000000028302'),
  'C2: sin facturas activas, la deuda vuelve al total de la orden');
select throws_ok(
  format($$select public.receive_purchase_line('%s', '51000000-0000-0000-0000-000000028302', 1, 2000, 0)$$, (select id from t_ids where k = 'fe200')),
  'P0001', 'invoice_voided', 'C2: una factura anulada no admite líneas');
insert into t_ids select 'fe200b', public.create_purchase_invoice('50000000-0000-0000-0000-000000028302', 'FE-200', current_date, null, null, 40000, 0, 40000, '40000000-0000-0000-0000-000000028301', null);
select isnt((select id from t_ids where k = 'fe200b'), null, 'C2: el número de la anulada se puede volver a usar');

insert into t_ids select 'lA', public.receive_purchase_line((select id from t_ids where k = 'fe200b'), '51000000-0000-0000-0000-000000028302', 10, 2000, 0);
insert into t_ids select 'lB', public.receive_purchase_line((select id from t_ids where k = 'fe200b'), '51000000-0000-0000-0000-000000028303', 5, 2000, 0);
insert into t_ids select 'lC', public.receive_purchase_line((select id from t_ids where k = 'fe200b'), '51000000-0000-0000-0000-000000028304', 5, 2000, 0);
select throws_ok(
  format($$select public.void_purchase_invoice('%s')$$, (select id from t_ids where k = 'fe200b')),
  'P0001', 'invoice_has_lines', 'C2: con líneas activas no se anula');

-- C4: A — 10 a 1.000 + 10 a 2.000, se venden 15 al promedio → no hay stock para anular 10
select public.register_movement('30000000-0000-0000-0000-000000028301', '40000000-0000-0000-0000-000000028301', 'out', 15, null);
select throws_ok(
  format($$select public.void_purchase_receipt_line('%s')$$, (select id from t_ids where k = 'lA')),
  'P0001', 'stock_insufficient', 'C4: sin stock suficiente no se anula');

-- C4: B — 5 a 1.000 + 5 a 2.000, sin ventas → sale a 2.000 y el costo vuelve a 1.000
select lives_ok(format($$select public.void_purchase_receipt_line('%s')$$, (select id from t_ids where k = 'lB')), 'C4: anula B');
select is((select cost from public.products where id = '30000000-0000-0000-0000-000000028302'),
  1000.00::numeric, 'C4: B vuelve a su costo de antes');
select is((select sum(qty * unit_cost) from public.stock_movements where product_id = '30000000-0000-0000-0000-000000028302'),
  5000.00::numeric, 'C4: B vale 5 × 1.000');

-- C4: C — 5 a 1.000 + 5 a 2.000, se venden 5 al promedio (1.500) → anular deja 0 y $0
select public.register_movement('30000000-0000-0000-0000-000000028303', '40000000-0000-0000-0000-000000028301', 'out', 5, null);
select lives_ok(format($$select public.void_purchase_receipt_line('%s')$$, (select id from t_ids where k = 'lC')), 'C4: anula C');
select results_eq(
  $$select sum(qty), sum(qty * unit_cost) from public.stock_movements where product_id = '30000000-0000-0000-0000-000000028303'$$,
  $$values (0.000::numeric, 0.00::numeric)$$,
  'C4: C queda en 0 unidades y $0, sin valor sobrante');

-- La factura con líneas anuladas ya se puede anular (y la deuda vuelve al total).
select throws_ok(
  format($$select public.void_purchase_invoice('%s')$$, (select id from t_ids where k = 'fe200b')),
  'P0001', 'invoice_has_lines', 'C2: mientras quede una línea activa (A), no se anula');

select * from finish();
rollback;
