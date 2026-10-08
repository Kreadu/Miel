-- S28-01 — Recepción con factura, línea por línea y parcial: create_purchase_invoice,
-- receive_purchase_line, void_purchase_receipt_line, close_purchase_short, deuda según facturas.
-- Ver specs/S28-01-recepcion-con-factura.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

-- Fixtures: empresa A (dueña + miembro) y empresa B (dueño).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000028101', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-000000028102', 'member-a@test.local'),
  ('00000000-0000-0000-0000-000000028103', 'owner-b@test.local');
insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-000000028101', 'A'),
  ('10000000-0000-0000-0000-000000028102', 'B');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000028101', '10000000-0000-0000-0000-000000028101', 'owner', '00000000-0000-0000-0000-000000028101'),
  ('00000000-0000-0000-0000-000000028102', '10000000-0000-0000-0000-000000028101', 'member', '00000000-0000-0000-0000-000000028101'),
  ('00000000-0000-0000-0000-000000028103', '10000000-0000-0000-0000-000000028102', 'owner', '00000000-0000-0000-0000-000000028103');
insert into public.suppliers (id, tenant_id, name, created_by) values
  ('20000000-0000-0000-0000-000000028101', '10000000-0000-0000-0000-000000028101', 'Prov A', '00000000-0000-0000-0000-000000028101'),
  ('20000000-0000-0000-0000-000000028102', '10000000-0000-0000-0000-000000028102', 'Prov B', '00000000-0000-0000-0000-000000028103');
insert into public.products (id, tenant_id, sku, name, cost, price, created_by) values
  ('30000000-0000-0000-0000-000000028101', '10000000-0000-0000-0000-000000028101', 'A', 'Miel', 1000, 1500, '00000000-0000-0000-0000-000000028101'),
  ('30000000-0000-0000-0000-000000028102', '10000000-0000-0000-0000-000000028101', 'B', 'Polen', 2000, 3000, '00000000-0000-0000-0000-000000028101'),
  ('30000000-0000-0000-0000-000000028103', '10000000-0000-0000-0000-000000028102', 'X', 'Ajeno', 100, 200, '00000000-0000-0000-0000-000000028103');
insert into public.warehouses (id, tenant_id, name, created_by) values
  ('40000000-0000-0000-0000-000000028101', '10000000-0000-0000-0000-000000028101', 'Bodega', '00000000-0000-0000-0000-000000028101'),
  ('40000000-0000-0000-0000-000000028102', '10000000-0000-0000-0000-000000028102', 'Bodega B', '00000000-0000-0000-0000-000000028103');
insert into public.stock_movements (tenant_id, product_id, warehouse_id, kind, qty, unit_cost, created_by) values
  ('10000000-0000-0000-0000-000000028101', '30000000-0000-0000-0000-000000028101', '40000000-0000-0000-0000-000000028101', 'in', 10, 1000, '00000000-0000-0000-0000-000000028101');
-- P1: 10 A + 5 B. P3: 4 A (dos facturas). P4: recibir todo (receive_purchase). P2: de B.
insert into public.purchases (id, tenant_id, supplier_id, status, issued_at, total, created_by) values
  ('50000000-0000-0000-0000-000000028101', '10000000-0000-0000-0000-000000028101', '20000000-0000-0000-0000-000000028101', 'ordered', now(), 21900, '00000000-0000-0000-0000-000000028101'),
  ('50000000-0000-0000-0000-000000028102', '10000000-0000-0000-0000-000000028102', '20000000-0000-0000-0000-000000028102', 'ordered', now(), 100, '00000000-0000-0000-0000-000000028103'),
  ('50000000-0000-0000-0000-000000028103', '10000000-0000-0000-0000-000000028101', '20000000-0000-0000-0000-000000028101', 'ordered', now(), 4000, '00000000-0000-0000-0000-000000028101'),
  ('50000000-0000-0000-0000-000000028104', '10000000-0000-0000-0000-000000028101', '20000000-0000-0000-0000-000000028101', 'ordered', now(), 1000, '00000000-0000-0000-0000-000000028101');
insert into public.purchase_items (id, tenant_id, purchase_id, product_id, qty, unit_cost, tax_rate) values
  ('51000000-0000-0000-0000-000000028101', '10000000-0000-0000-0000-000000028101', '50000000-0000-0000-0000-000000028101', '30000000-0000-0000-0000-000000028101', 10, 1000, 19),
  ('51000000-0000-0000-0000-000000028102', '10000000-0000-0000-0000-000000028101', '50000000-0000-0000-0000-000000028101', '30000000-0000-0000-0000-000000028102', 5, 2000, 0),
  ('51000000-0000-0000-0000-000000028103', '10000000-0000-0000-0000-000000028102', '50000000-0000-0000-0000-000000028102', '30000000-0000-0000-0000-000000028103', 1, 100, 0),
  ('51000000-0000-0000-0000-000000028104', '10000000-0000-0000-0000-000000028101', '50000000-0000-0000-0000-000000028103', '30000000-0000-0000-0000-000000028101', 4, 1000, 0),
  ('51000000-0000-0000-0000-000000028105', '10000000-0000-0000-0000-000000028101', '50000000-0000-0000-0000-000000028104', '30000000-0000-0000-0000-000000028102', 1, 1000, 0);

-- === Dueña de A ===
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000028101", "role": "authenticated"}';

create temp table t_ids (k text primary key, id uuid) on commit drop;
grant all on t_ids to authenticated;

-- C1: factura FE-123 y línea A con 6 unidades a 1.200 (antes 1.000)
insert into t_ids select 'fe123', public.create_purchase_invoice(
  '50000000-0000-0000-0000-000000028101', 'FE-123', current_date, null, null, 7200, 1368, 8568,
  '40000000-0000-0000-0000-000000028101', null);
select isnt((select id from t_ids where k = 'fe123'), null, 'C1: crea la factura');

select throws_ok(
  $$select public.create_purchase_invoice('50000000-0000-0000-0000-000000028101', 'fe-123', current_date, null, null,
      1, 0, 1, '40000000-0000-0000-0000-000000028101', null)$$,
  'P0001', 'invoice_number_taken', 'C4: número repetido para el proveedor (sin distinguir mayúsculas)');
select throws_ok(
  $$select public.create_purchase_invoice('50000000-0000-0000-0000-000000028101', 'FE-124', current_date, null, null,
      100, 19, 120, '40000000-0000-0000-0000-000000028101', null)$$,
  'P0001', 'invoice_totals_invalid', 'C4: total distinto de subtotal + IVA');
select throws_ok(
  $$select public.create_purchase_invoice('50000000-0000-0000-0000-000000028101', 'FE-125', current_date, null, null,
      100, 0, 100, '40000000-0000-0000-0000-000000028102', null)$$,
  'P0001', 'warehouse_invalid', 'C4: bodega de otra empresa');
select throws_ok(
  $$select public.create_purchase_invoice('50000000-0000-0000-0000-000000028101', 'FE-126', current_date, null, null,
      100, 0, 100, '40000000-0000-0000-0000-000000028101', '10000000-0000-0000-0000-000000028102/x.pdf')$$,
  'P0001', 'invoice_file_invalid', 'C4: archivo fuera de la carpeta de la empresa');
select throws_ok(
  $$select public.create_purchase_invoice('50000000-0000-0000-0000-000000028102', 'FE-1', current_date, null, null,
      100, 0, 100, '40000000-0000-0000-0000-000000028101', null)$$,
  'P0001', 'purchase_not_found', 'C4: orden de otra empresa');

insert into t_ids select 'lineA', public.receive_purchase_line(
  (select id from t_ids where k = 'fe123'), '51000000-0000-0000-0000-000000028101', 6, 1200, 19);
select is((select sum(qty) from public.stock_movements
           where product_id = '30000000-0000-0000-0000-000000028101' and warehouse_id = '40000000-0000-0000-0000-000000028101'),
  16.000::numeric, 'C1: entran 6 a la bodega de la factura');
select is((select unit_cost from public.stock_movements where id =
           (select movement_id from public.purchase_receipt_lines where id = (select id from t_ids where k = 'lineA'))),
  1200.00::numeric, 'C1: el kardex entra al costo real sin IVA');
select is((select cost from public.products where id = '30000000-0000-0000-0000-000000028101'),
  1075.00::numeric, 'C1: costo promedio (10×1000 + 6×1200) / 16');
select is((select status from public.purchases where id = '50000000-0000-0000-0000-000000028101'),
  'partially_received', 'C1: la orden queda recibida parcial');
select is((select received_qty from public.purchase_items where id = '51000000-0000-0000-0000-000000028101'),
  6.000::numeric, 'C1: recibido 6, pendiente 4');
select throws_ok(
  format($$select public.receive_purchase_line('%s', '51000000-0000-0000-0000-000000028101', 5, 1200, 19)$$,
         (select id from t_ids where k = 'fe123')),
  'P0001', 'qty_exceeds_pending', 'C4: no se recibe más de lo pendiente');
select is((select count(*)::int from public.purchase_receipt_lines
           where purchase_item_id = '51000000-0000-0000-0000-000000028101'),
  1, 'C4: el rechazo no deja líneas a medias');
select throws_ok(
  format($$select public.receive_purchase_line('%s', '51000000-0000-0000-0000-000000028101', 0, 1200, 19)$$,
         (select id from t_ids where k = 'fe123')),
  'P0001', 'qty_invalid', 'C4: cantidad 0');
select throws_ok(
  format($$select public.receive_purchase_line('%s', '51000000-0000-0000-0000-000000028104', 1, 1000, 0)$$,
         (select id from t_ids where k = 'fe123')),
  'P0001', 'item_invalid', 'C4: ítem de otra orden con esta factura');
select throws_ok(
  $$select public.cancel_purchase('50000000-0000-0000-0000-000000028101')$$,
  'P0001', 'purchase_not_cancellable', 'C1: una orden con algo recibido no se cancela');
select throws_ok(
  $$select public.update_purchase('50000000-0000-0000-0000-000000028101', '20000000-0000-0000-0000-000000028101',
      '[{"product_id": "30000000-0000-0000-0000-000000028101", "qty": 1, "unit_cost": 1}]'::jsonb, null)$$,
  'P0001', 'purchase_not_updatable', 'C1: ni se edita');
select is((select invoiced_total from public.purchases where id = '50000000-0000-0000-0000-000000028101'),
  8568.00::numeric, 'C2: la deuda de la orden es el total de su factura');
select is((select total_purchases from public.supplier_balances where supplier_id = '20000000-0000-0000-0000-000000028101'),
  8568.00 + 4000 + 1000, 'C2: cuentas por pagar usan la factura (las otras órdenes, su total)');

-- === Miembro de A: recibe cantidades, el costo es el de la orden ===
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000028102", "role": "authenticated"}';
insert into t_ids select 'lineB', public.receive_purchase_line(
  (select id from t_ids where k = 'fe123'), '51000000-0000-0000-0000-000000028102', 2, 9999, 19);
select is((select count(*)::int from public.purchase_invoices), 0, 'C5: el miembro no ve facturas');
select is((select count(*)::int from public.purchase_receipt_lines), 0, 'C5: ni líneas con costos');
select throws_ok(
  format($$select public.void_purchase_receipt_line('%s')$$, (select id from t_ids where k = 'lineA')),
  'P0001', 'permission_denied', 'C4: el miembro no anula');
reset role;
select is((select unit_cost from public.purchase_receipt_lines where id = (select id from t_ids where k = 'lineB')),
  2000.00::numeric, 'R2: si recibe un miembro, entra al costo de la orden');
select is((select tax_rate from public.purchase_receipt_lines where id = (select id from t_ids where k = 'lineB')),
  0.00::numeric, 'R2: y con el IVA de la orden');

-- === Dueña: anular la línea A ===
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000028101", "role": "authenticated"}';
select lives_ok(
  format($$select public.void_purchase_receipt_line('%s')$$, (select id from t_ids where k = 'lineA')),
  'C4: la dueña anula la línea');
select is((select sum(qty) from public.stock_movements where product_id = '30000000-0000-0000-0000-000000028101'),
  10.000::numeric, 'C4: salen las 6 del kardex');
select is((select cost from public.products where id = '30000000-0000-0000-0000-000000028101'),
  1000.00::numeric, 'C4: el costo promedio vuelve a 1.000');
select is((select received_qty from public.purchase_items where id = '51000000-0000-0000-0000-000000028101'),
  0.000::numeric, 'C4: vuelve a quedar pendiente');
select throws_ok(
  format($$select public.void_purchase_receipt_line('%s')$$, (select id from t_ids where k = 'lineA')),
  'P0001', 'line_already_voided', 'C4: no se anula dos veces');

-- C3: cerrar con faltantes (quedan 2 B recibidas)
select throws_ok(
  $$select public.close_purchase_short('50000000-0000-0000-0000-000000028103', 'x')$$,
  'P0001', 'purchase_not_partial', 'C3: solo se cierra una orden parcial');
select lives_ok(
  $$select public.close_purchase_short('50000000-0000-0000-0000-000000028101', 'El proveedor no tiene más')$$,
  'C3: cierra con faltantes');
select results_eq(
  $$select status, closed_short, shortage_note from public.purchases where id = '50000000-0000-0000-0000-000000028101'$$,
  $$values ('received'::text, true, 'El proveedor no tiene más'::text)$$,
  'C3: queda recibida, con faltantes y la nota');
select throws_ok(
  format($$select public.receive_purchase_line('%s', '51000000-0000-0000-0000-000000028101', 1, 1000, 19)$$,
         (select id from t_ids where k = 'fe123')),
  'P0001', 'purchase_not_receivable', 'C3: ya no admite más líneas');

-- C2: dos facturas completan la orden P3
insert into t_ids select 'fe200', public.create_purchase_invoice(
  '50000000-0000-0000-0000-000000028103', 'FE-200', current_date, current_date + 30, 'cufe-1', 2000, 0, 2000,
  '40000000-0000-0000-0000-000000028101', '10000000-0000-0000-0000-000000028101/fe200.pdf');
select public.receive_purchase_line((select id from t_ids where k = 'fe200'), '51000000-0000-0000-0000-000000028104', 2, 1000, 0);
insert into t_ids select 'fe201', public.create_purchase_invoice(
  '50000000-0000-0000-0000-000000028103', 'FE-201', current_date, null, null, 2100, 0, 2100,
  '40000000-0000-0000-0000-000000028101', null);
select public.receive_purchase_line((select id from t_ids where k = 'fe201'), '51000000-0000-0000-0000-000000028104', 2, 1050, 0);
select is((select status from public.purchases where id = '50000000-0000-0000-0000-000000028103'),
  'received', 'C2: con todo recibido la orden queda recibida');
select is((select invoiced_total from public.purchases where id = '50000000-0000-0000-0000-000000028103'),
  4100.00::numeric, 'C2: la deuda es la suma de las dos facturas');

-- receive_purchase (recibir todo) deja lo recibido completo
select public.receive_purchase('50000000-0000-0000-0000-000000028104', '40000000-0000-0000-0000-000000028101');
select is((select received_qty from public.purchase_items where id = '51000000-0000-0000-0000-000000028105'),
  1.000::numeric, 'receive_purchase marca todo como recibido');

-- === Dueño de B no toca A ===
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000028103", "role": "authenticated"}';
select throws_ok(
  format($$select public.receive_purchase_line('%s', '51000000-0000-0000-0000-000000028101', 1, 1, 0)$$,
         (select id from t_ids where k = 'fe123')),
  'P0001', 'purchase_not_found', 'C4: otra empresa no recibe con la factura de A');
select throws_ok(
  format($$select public.void_purchase_receipt_line('%s')$$, (select id from t_ids where k = 'lineB')),
  'P0001', 'line_not_found', 'C4: ni anula sus líneas');
select throws_ok(
  $$select public.close_purchase_short('50000000-0000-0000-0000-000000028103', null)$$,
  'P0001', 'purchase_not_found', 'C4: ni cierra sus órdenes');

select * from finish();
rollback;
