begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- Fixtures
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000aaa1', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000bbb1', 'owner-b@test.local'),
  ('00000000-0000-0000-0000-00000000ccc1', 'member-a@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-00000000aaa1', 'Tenant A'),
  ('10000000-0000-0000-0000-00000000bbb1', 'Tenant B');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-00000000aaa1', '10000000-0000-0000-0000-00000000aaa1', 'owner', '00000000-0000-0000-0000-00000000aaa1'),
  ('00000000-0000-0000-0000-00000000bbb1', '10000000-0000-0000-0000-00000000bbb1', 'owner', '00000000-0000-0000-0000-00000000bbb1'),
  ('00000000-0000-0000-0000-00000000ccc1', '10000000-0000-0000-0000-00000000aaa1', 'member', '00000000-0000-0000-0000-00000000aaa1');

insert into public.warehouses (id, tenant_id, name, created_by) values
  ('30000000-0000-0000-0000-00000000aaa1', '10000000-0000-0000-0000-00000000aaa1', 'Bodega A', '00000000-0000-0000-0000-00000000aaa1'),
  ('30000000-0000-0000-0000-00000000bbb1', '10000000-0000-0000-0000-00000000bbb1', 'Bodega B', '00000000-0000-0000-0000-00000000bbb1');

-- Simular al owner del tenant A
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-00000000aaa1", "role": "authenticated"}';

-- === C1: alta con stock inicial crea producto + 1 movimiento in ===
select lives_ok(
  $$select public.create_product_with_stock(
      p_tenant_id => '10000000-0000-0000-0000-00000000aaa1', p_sku => 'SKU-001',
      p_name => 'Producto con stock', p_unit => 'unidad', p_kind => 'raw',
      p_cost => 100, p_price => 200, p_tax_rate => 19, p_min_stock => 0,
      p_warehouse_id => '30000000-0000-0000-0000-00000000aaa1', p_qty => 10
  )$$,
  'C1: alta con stock inicial no falla');

select is(
  (select count(*)::int from public.products where sku = 'SKU-001'),
  1, 'C1: el producto quedó creado');

select is(
  (select count(*)::int from public.stock_movements sm join public.products p on p.id = sm.product_id where p.sku = 'SKU-001'),
  1, 'C1: se creó exactamente 1 movimiento');

select is(
  (select qty from public.stock_movements sm join public.products p on p.id = sm.product_id where p.sku = 'SKU-001'),
  10.000::numeric, 'C1: qty del movimiento es 10');

select is(
  (select unit_cost from public.stock_movements sm join public.products p on p.id = sm.product_id where p.sku = 'SKU-001'),
  100.00::numeric, 'C1: unit_cost del movimiento es el costo del producto (100)');

-- === C2: alta sin stock inicial crea solo el producto ===
select lives_ok(
  $$select public.create_product_with_stock(
      p_tenant_id => '10000000-0000-0000-0000-00000000aaa1', p_sku => 'SKU-002',
      p_name => 'Producto sin stock', p_unit => 'unidad', p_kind => 'raw',
      p_cost => 50, p_price => 90, p_tax_rate => 19, p_min_stock => 0
  )$$,
  'C2: alta sin stock inicial no falla');

select is(
  (select count(*)::int from public.stock_movements sm join public.products p on p.id = sm.product_id where p.sku = 'SKU-002'),
  0, 'C2: no se creó ningún movimiento');

-- === C3: bodega de otro tenant revierte todo (atomicidad) ===
select throws_ok(
  $$select public.create_product_with_stock(
      p_tenant_id => '10000000-0000-0000-0000-00000000aaa1', p_sku => 'SKU-003',
      p_name => 'Producto atomico', p_unit => 'unidad', p_kind => 'raw',
      p_cost => 10, p_price => 20, p_tax_rate => 19, p_min_stock => 0,
      p_warehouse_id => '30000000-0000-0000-0000-00000000bbb1', p_qty => 5
  )$$,
  'P0001', null, 'C3: bodega de otro tenant lanza excepción');

select is(
  (select count(*)::int from public.products where sku = 'SKU-003'),
  0, 'C3: el producto no quedó creado (atomicidad)');

-- === C4: member no puede crear productos (RLS de products_admin_write) ===
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-00000000ccc1", "role": "authenticated"}';

select throws_ok(
  $$select public.create_product_with_stock(
      p_tenant_id => '10000000-0000-0000-0000-00000000aaa1', p_sku => 'SKU-004',
      p_name => 'Producto member', p_unit => 'unidad', p_kind => 'raw',
      p_cost => 10, p_price => 20, p_tax_rate => 19, p_min_stock => 0
  )$$,
  '42501', null, 'C4: member no puede crear productos');

select * from finish();
rollback;
