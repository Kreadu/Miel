-- S5-08 — Descuentos por ítem (create_sale) y numeración consecutiva de recibos (confirm_sale).
-- Ver specs/S5-08-descuentos-consecutivo.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Fixtures: tenant A (owner + member) y tenant B (owner), cada uno con producto y bodega.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000c002', 'member-a@test.local'),
  ('00000000-0000-0000-0000-00000000c003', 'owner-b@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-00000000c001', 'Tenant A'),
  ('10000000-0000-0000-0000-00000000c002', 'Tenant B');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-00000000c001', '10000000-0000-0000-0000-00000000c001', 'owner',
   '00000000-0000-0000-0000-00000000c001'),
  ('00000000-0000-0000-0000-00000000c002', '10000000-0000-0000-0000-00000000c001', 'member',
   '00000000-0000-0000-0000-00000000c001'),
  ('00000000-0000-0000-0000-00000000c003', '10000000-0000-0000-0000-00000000c002', 'owner',
   '00000000-0000-0000-0000-00000000c003');

insert into public.warehouses (id, tenant_id, name, created_by) values
  ('30000000-0000-0000-0000-00000000c001', '10000000-0000-0000-0000-00000000c001', 'Bodega A',
   '00000000-0000-0000-0000-00000000c001'),
  ('30000000-0000-0000-0000-00000000c002', '10000000-0000-0000-0000-00000000c002', 'Bodega B',
   '00000000-0000-0000-0000-00000000c003');

insert into public.products (id, tenant_id, sku, name, cost, price, created_by) values
  ('40000000-0000-0000-0000-00000000c001', '10000000-0000-0000-0000-00000000c001', 'SKU-C1',
   'Producto C1', 50, 100, '00000000-0000-0000-0000-00000000c001'),
  ('40000000-0000-0000-0000-00000000c002', '10000000-0000-0000-0000-00000000c002', 'SKU-D1',
   'Producto D1', 100, 200, '00000000-0000-0000-0000-00000000c003');

-- Stock suficiente para confirmar varias ventas
insert into public.stock_movements (tenant_id, product_id, warehouse_id, kind, qty, unit_cost, created_by) values
  ('10000000-0000-0000-0000-00000000c001', '40000000-0000-0000-0000-00000000c001',
   '30000000-0000-0000-0000-00000000c001', 'in', 100, 50, '00000000-0000-0000-0000-00000000c001'),
  ('10000000-0000-0000-0000-00000000c002', '40000000-0000-0000-0000-00000000c002',
   '30000000-0000-0000-0000-00000000c002', 'in', 100, 100, '00000000-0000-0000-0000-00000000c003');

-- === Simular al owner del tenant A ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000c001", "role": "authenticated"}';

-- === C1: create_sale con descuento por ítem calcula subtotal/tax/total netos ===
-- qty=2, unit_price=100, discount=20 -> línea neta = 180; tax_rate=0 -> tax=0; total=180
select lives_ok(
  $$select public.create_sale(
      '10000000-0000-0000-0000-00000000c001',
      '[{"product_id": "40000000-0000-0000-0000-00000000c001", "qty": 2, "unit_price": 100, "discount": 20}]'::jsonb
  )$$,
  'C1: create_sale con descuento por ítem no falla');

select is(
  (select discount from public.sale_items si
   join public.sales s on s.id = si.sale_id
   where s.tenant_id = '10000000-0000-0000-0000-00000000c001'
   order by si.created_at desc limit 1),
  20.00::numeric, 'C1: el ítem persiste el discount');

select is(
  (select subtotal from public.sales
   where tenant_id = '10000000-0000-0000-0000-00000000c001'
   order by created_at desc limit 1),
  180.00::numeric, 'C1: subtotal neto de descuento (200-20=180)');

select is(
  (select total from public.sales
   where tenant_id = '10000000-0000-0000-0000-00000000c001'
   order by created_at desc limit 1),
  180.00::numeric, 'C1: total neto de descuento');

-- === C2: discount mayor a la línea es rechazado, nada se crea ===
select throws_ok(
  $$select public.create_sale(
      '10000000-0000-0000-0000-00000000c001',
      '[{"product_id": "40000000-0000-0000-0000-00000000c001", "qty": 1, "unit_price": 100, "discount": 150}]'::jsonb
  )$$,
  'P0001', 'item_discount_invalid', 'C2: discount mayor a la línea es rechazado');

select is(
  (select count(*)::int from public.sales
   where tenant_id = '10000000-0000-0000-0000-00000000c001' and subtotal = 0),
  0, 'C2: ninguna venta huérfana quedó creada tras el rechazo');

-- === C3/C5: confirm_sale asigna receipt_number consecutivo por tenant, null en draft ===
select is(
  (select receipt_number from public.sales
   where tenant_id = '10000000-0000-0000-0000-00000000c001' and status = 'draft'
   order by created_at desc limit 1),
  null, 'C5: receipt_number es null mientras la venta está en draft');

-- Nota: todo el archivo corre en una sola transacción (begin/rollback), y now() devuelve el
-- mismo instante para toda la transacción — ordenar por issued_at/created_at no distingue
-- entre confirmaciones sucesivas. Se capturan los ids explícitamente en tablas temporales.
create temporary table t_first_sale as
select id from public.sales
where tenant_id = '10000000-0000-0000-0000-00000000c001' and status = 'draft'
order by created_at asc limit 1;

-- Confirmar la primera venta creada arriba (la del descuento válido)
select lives_ok(
  $$select public.confirm_sale(
      (select id from t_first_sale),
      '30000000-0000-0000-0000-00000000c001'::uuid
  )$$,
  'C3: primera confirmación del tenant A no falla');

select is(
  (select receipt_number from public.sales where id = (select id from t_first_sale)),
  1, 'C3: la primera venta confirmada del tenant recibe receipt_number 1');

-- Crear y confirmar una segunda venta del mismo tenant A
select public.create_sale(
  '10000000-0000-0000-0000-00000000c001',
  '[{"product_id": "40000000-0000-0000-0000-00000000c001", "qty": 1, "unit_price": 100}]'::jsonb
);

create temporary table t_second_sale as
select id from public.sales
where tenant_id = '10000000-0000-0000-0000-00000000c001' and status = 'draft'
order by created_at asc limit 1;

select lives_ok(
  $$select public.confirm_sale(
      (select id from t_second_sale),
      '30000000-0000-0000-0000-00000000c001'::uuid
  )$$,
  'C3: segunda confirmación del tenant A no falla');

select is(
  (select receipt_number from public.sales where id = (select id from t_second_sale)),
  2, 'C3: la segunda venta confirmada del tenant recibe receipt_number 2 (sin huecos)');

-- === C4: tenant B tiene su propia secuencia independiente, arranca en 1 ===
reset role;
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000c003", "role": "authenticated"}';

select public.create_sale(
  '10000000-0000-0000-0000-00000000c002',
  '[{"product_id": "40000000-0000-0000-0000-00000000c002", "qty": 1, "unit_price": 200}]'::jsonb
);

select public.confirm_sale(
  (select id from public.sales
   where tenant_id = '10000000-0000-0000-0000-00000000c002' and status = 'draft'
   order by created_at asc limit 1),
  '30000000-0000-0000-0000-00000000c002'::uuid
);

select is(
  (select receipt_number from public.sales
   where tenant_id = '10000000-0000-0000-0000-00000000c002' and status = 'confirmed'
   order by issued_at asc limit 1),
  1, 'C4: tenant B tiene su propia secuencia, arranca en 1 (independiente de A)');

-- Aislamiento: el owner de B no ve el contador de A
select is(
  (select count(*)::int from public.sale_counters
   where tenant_id = '10000000-0000-0000-0000-00000000c001'),
  0, 'C4: tenant B no ve el contador de tenant A (aislamiento de sale_counters)');

select * from finish();
rollback;
