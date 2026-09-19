begin;
select plan(7);

-- Setup
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'admin@test.com');
insert into public.tenants (id, name) values ('00000000-0000-0000-0000-000000000001', 'Tenant 1');
insert into public.memberships (user_id, tenant_id, role, created_by) values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'admin', '11111111-1111-1111-1111-111111111111');
insert into public.warehouses (id, tenant_id, name, created_by) values ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001', 'Bodega 1', '11111111-1111-1111-1111-111111111111');

-- Products
insert into public.products (id, tenant_id, sku, name, kind, cost, price, created_by) values 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', 'RAW1', 'Insumo 1', 'raw', 10, 0, '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000001', 'RAW2', 'Insumo 2', 'raw', 20, 0, '11111111-1111-1111-1111-111111111111'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000001', 'FIN1', 'Terminado 1', 'finished', 0, 100, '11111111-1111-1111-1111-111111111111');

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"11111111-1111-1111-1111-111111111111", "role":"authenticated"}';

-- Add initial stock for raw materials
select public.register_movement('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'in', 100, 10, 'manual', null, 'inicial 1');
select public.register_movement('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'in', 50, 20, 'manual', null, 'inicial 2');

-- Test 1: Valid production
select lives_ok(
  $$ select public.register_production('00000000-0000-0000-0000-000000000001'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 10::numeric, '[{"product_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "qty": 20}, {"product_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "qty": 5}]'::jsonb) $$,
  'Registrar produccion valida'
);

-- Test 2, 3, 4: Verify stock deductions and additions
select is(
  (select sum(qty) from public.stock_movements where product_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  80.000::numeric,
  'Insumo 1 redujo 20 de stock'
);

select is(
  (select sum(qty) from public.stock_movements where product_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  10.000::numeric,
  'Terminado 1 aumento 10 de stock'
);

-- Test 5: Verify unit cost of finished product
-- Costo = (20 * 10 + 5 * 20) / 10 = (200 + 100) / 10 = 300 / 10 = 30.
select is(
  (select cost from public.products_catalog where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  30.00::numeric,
  'Costo unitario del terminado se actualizo correctamente'
);

-- Test 6: Insufficient stock
select throws_ok(
  $$ select public.register_production('00000000-0000-0000-0000-000000000001'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 5::numeric, '[{"product_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "qty": 100}]'::jsonb) $$,
  'P0001', 'stock_insufficient',
  'Falla por stock insuficiente del insumo'
);

-- Test 7: Product not finished
select throws_ok(
  $$ select public.register_production('00000000-0000-0000-0000-000000000001'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 5::numeric, '[{"product_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "qty": 1}]'::jsonb) $$,
  'P0001', 'product_not_finished',
  'Falla si el producto destino no es finished'
);

-- Test 8: Empty consumptions
select throws_ok(
  $$ select public.register_production('00000000-0000-0000-0000-000000000001'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 5::numeric, '[]'::jsonb) $$,
  'P0001', 'invalid_quantity',
  'Falla si no hay consumos'
);

select * from finish();
rollback;
