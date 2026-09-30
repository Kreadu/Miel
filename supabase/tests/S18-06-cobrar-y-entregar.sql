-- S18-06 — checkout_counter_sale: venta de mostrador en un paso (crear + boleta + cobro total +
-- entrega) y comprobante boleta/factura; mark_invoice_issued (owner/admin).
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000018601', 'owner-s1806@test.local'),
  ('00000000-0000-0000-0000-000000018602', 'cajero-s1806@test.local'),
  ('00000000-0000-0000-0000-000000018603', 'ajeno-s1806@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-000000018601', 'Tenant S18-06'),
  ('10000000-0000-0000-0000-000000018602', 'Tenant ajeno S18-06');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000018601', '10000000-0000-0000-0000-000000018601', 'owner',
   '00000000-0000-0000-0000-000000018601'),
  ('00000000-0000-0000-0000-000000018602', '10000000-0000-0000-0000-000000018601', 'member',
   '00000000-0000-0000-0000-000000018601'),
  ('00000000-0000-0000-0000-000000018603', '10000000-0000-0000-0000-000000018602', 'owner',
   '00000000-0000-0000-0000-000000018603');

insert into public.warehouses (id, tenant_id, name, created_by) values
  ('30000000-0000-0000-0000-000000018601', '10000000-0000-0000-0000-000000018601', 'Bodega',
   '00000000-0000-0000-0000-000000018601');

insert into public.products (id, tenant_id, sku, name, cost, price, tax_rate, sales_channel, created_by) values
  ('40000000-0000-0000-0000-000000018601', '10000000-0000-0000-0000-000000018601', 'S1806-T',
   'Tienda', 10, 100, 19, 'in_store', '00000000-0000-0000-0000-000000018601');

insert into public.stock_movements (tenant_id, product_id, warehouse_id, kind, qty, unit_cost, created_by) values
  ('10000000-0000-0000-0000-000000018601', '40000000-0000-0000-0000-000000018601',
   '30000000-0000-0000-0000-000000018601', 'in', 10, 10, '00000000-0000-0000-0000-000000018601');

insert into public.customers (id, tenant_id, name, is_generic, created_by) values
  ('50000000-0000-0000-0000-000000018601', '10000000-0000-0000-0000-000000018601', 'Cliente genérico', true,
   '00000000-0000-0000-0000-000000018601');
insert into public.customers (id, tenant_id, name, doc_type, doc_number, created_by) values
  ('50000000-0000-0000-0000-000000018602', '10000000-0000-0000-0000-000000018601', 'Empresa SAS', 'nit', '900123456',
   '00000000-0000-0000-0000-000000018601'),
  ('50000000-0000-0000-0000-000000018603', '10000000-0000-0000-0000-000000018601', 'Sin documento', 'cc', null,
   '00000000-0000-0000-0000-000000018601');

insert into public.warehouses (id, tenant_id, name, is_default, created_by) values
  ('30000000-0000-0000-0000-000000018602', '10000000-0000-0000-0000-000000018601', 'Principal', true,
   '00000000-0000-0000-0000-000000018601');
insert into public.workers (id, tenant_id, full_name, doc_number, warehouse_id, created_by) values
  ('60000000-0000-0000-0000-000000018601', '10000000-0000-0000-0000-000000018601', 'Con bodega', '1',
   '30000000-0000-0000-0000-000000018601', '00000000-0000-0000-0000-000000018601'),
  ('60000000-0000-0000-0000-000000018602', '10000000-0000-0000-0000-000000018601', 'Sin bodega', '2', null,
   '00000000-0000-0000-0000-000000018601');

create temp table s1806 (label text, sale_id uuid) on commit drop;
grant all on s1806 to authenticated;

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000018602", "role": "authenticated"}';

-- === Caja cerrada: nada guardado ===
select throws_ok(
  $$select public.checkout_counter_sale('10000000-0000-0000-0000-000000018601',
    '[{"product_id": "40000000-0000-0000-0000-000000018601", "qty": 1}]'::jsonb,
    '50000000-0000-0000-0000-000000018601', 'cash', '30000000-0000-0000-0000-000000018601', 'boleta')$$,
  'P0001', 'cash_session_required', 'sin caja abierta no cobra');
select is((select count(*)::int from public.sales where tenant_id = '10000000-0000-0000-0000-000000018601'),
  0, 'atomicidad: sin caja no queda la venta en borrador');

select public.open_cash_session(0, '10000000-0000-0000-0000-000000018601');

-- === Sin forma de pago ===
select throws_ok(
  $$select public.checkout_counter_sale('10000000-0000-0000-0000-000000018601',
    '[{"product_id": "40000000-0000-0000-0000-000000018601", "qty": 1}]'::jsonb,
    '50000000-0000-0000-0000-000000018601', null, '30000000-0000-0000-0000-000000018601', 'boleta')$$,
  'P0001', 'payment_method_required', 'exige forma de pago');

-- === Sin stock: nada guardado ===
select throws_ok(
  $$select public.checkout_counter_sale('10000000-0000-0000-0000-000000018601',
    '[{"product_id": "40000000-0000-0000-0000-000000018601", "qty": 99}]'::jsonb,
    '50000000-0000-0000-0000-000000018601', 'cash', '30000000-0000-0000-0000-000000018601', 'boleta')$$,
  'P0001', 'stock_insufficient', 'sin stock no cobra');
select is((select count(*)::int from public.sales where tenant_id = '10000000-0000-0000-0000-000000018601'),
  0, 'atomicidad: sin stock no queda nada');

-- === Caso feliz: boleta con tarjeta, 2 unidades ===
insert into s1806 values ('boleta', public.checkout_counter_sale('10000000-0000-0000-0000-000000018601',
  '[{"product_id": "40000000-0000-0000-0000-000000018601", "qty": 2}]'::jsonb,
  '50000000-0000-0000-0000-000000018601', 'card', '30000000-0000-0000-0000-000000018601', 'boleta'));

select is((select status from public.sales where id = (select sale_id from s1806 where label = 'boleta')),
  'delivered', 'la venta queda entregada');
select isnt((select receipt_number from public.sales where id = (select sale_id from s1806 where label = 'boleta')),
  null, 'con consecutivo de boleta');
select is((select document_type from public.sales where id = (select sale_id from s1806 where label = 'boleta')),
  'boleta', 'comprobante boleta');
select is((select total from public.sales where id = (select sale_id from s1806 where label = 'boleta')),
  238::numeric, 'total 2 × 100 + IVA 19 %');
select results_eq(
  $$select sum(amount), min(method) from public.customer_payments
    where sale_id = (select sale_id from s1806 where label = 'boleta')$$,
  $$values (238::numeric, 'card'::text)$$,
  'cobrada por el total con la forma de pago elegida');
select is(
  (select sum(qty)::int from public.stock_movements
   where product_id = '40000000-0000-0000-0000-000000018601'
     and warehouse_id = '30000000-0000-0000-0000-000000018601'),
  8, 'descuenta el stock en la bodega elegida');
select isnt((select cash_session_id from public.sales where id = (select sale_id from s1806 where label = 'boleta')),
  null, 'queda ligada a la caja');

-- === Factura: exige cliente identificado ===
select throws_ok(
  $$select public.checkout_counter_sale('10000000-0000-0000-0000-000000018601',
    '[{"product_id": "40000000-0000-0000-0000-000000018601", "qty": 1}]'::jsonb,
    '50000000-0000-0000-0000-000000018601', 'cash', '30000000-0000-0000-0000-000000018601', 'factura')$$,
  'P0001', 'invoice_customer_required', 'factura no vale con el cliente genérico');
select throws_ok(
  $$select public.checkout_counter_sale('10000000-0000-0000-0000-000000018601',
    '[{"product_id": "40000000-0000-0000-0000-000000018601", "qty": 1}]'::jsonb,
    '50000000-0000-0000-0000-000000018603', 'cash', '30000000-0000-0000-0000-000000018601', 'factura')$$,
  'P0001', 'invoice_customer_required', 'factura no vale con un cliente sin documento');

insert into s1806 values ('factura', public.checkout_counter_sale('10000000-0000-0000-0000-000000018601',
  '[{"product_id": "40000000-0000-0000-0000-000000018601", "qty": 1}]'::jsonb,
  '50000000-0000-0000-0000-000000018602', 'transfer', '30000000-0000-0000-0000-000000018601', 'factura'));

select results_eq(
  $$select document_type, invoice_issued_at is null from public.sales
    where id = (select sale_id from s1806 where label = 'factura')$$,
  $$values ('factura'::text, true)$$,
  'factura queda por emitir');

-- === mark_invoice_issued: solo owner/admin ===
select throws_ok(
  $$select public.mark_invoice_issued((select sale_id from s1806 where label = 'factura'))$$,
  'P0001', 'permission_denied', 'un operativo no marca la factura emitida');

set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000018601", "role": "authenticated"}';
select lives_ok(
  $$select public.mark_invoice_issued((select sale_id from s1806 where label = 'factura'))$$,
  'el dueño la marca emitida');
select isnt((select invoice_issued_at from public.sales where id = (select sale_id from s1806 where label = 'factura')),
  null, 'queda con fecha de emisión');
select throws_ok(
  $$select public.mark_invoice_issued((select sale_id from s1806 where label = 'boleta'))$$,
  'P0001', 'not_an_invoice', 'una boleta no se marca como factura emitida');

-- === Bodega preseleccionada ===
select is(public.default_sale_warehouse('10000000-0000-0000-0000-000000018601',
  '60000000-0000-0000-0000-000000018601'), '30000000-0000-0000-0000-000000018601'::uuid,
  'la del trabajador identificado');
select is(public.default_sale_warehouse('10000000-0000-0000-0000-000000018601',
  '60000000-0000-0000-0000-000000018602'), '30000000-0000-0000-0000-000000018602'::uuid,
  'trabajador sin bodega: la principal');
select is(public.default_sale_warehouse('10000000-0000-0000-0000-000000018601'),
  '30000000-0000-0000-0000-000000018602'::uuid, 'sin trabajador: la principal');

-- === Tenant ajeno ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000018603", "role": "authenticated"}';
select throws_ok(
  $$select public.checkout_counter_sale('10000000-0000-0000-0000-000000018601',
    '[{"product_id": "40000000-0000-0000-0000-000000018601", "qty": 1}]'::jsonb,
    '50000000-0000-0000-0000-000000018601', 'cash', '30000000-0000-0000-0000-000000018601', 'boleta')$$,
  'P0001', 'permission_denied', 'un usuario de otra empresa no vende en esta');
select is(public.default_sale_warehouse('10000000-0000-0000-0000-000000018601'), null,
  'otra empresa no ve sus bodegas');

select * from finish();
rollback;
