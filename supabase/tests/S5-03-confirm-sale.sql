-- S5-03 — Confirmación de venta: confirm_sale (draft -> confirmed + salidas de stock).
-- Ver specs/S5-03-confirmacion-venta.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Fixtures: tenant A (owner + member) y tenant B (owner)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a001', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000a002', 'member-a@test.local'),
  ('00000000-0000-0000-0000-00000000b001', 'owner-b@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-00000000a001', 'Tenant A'),
  ('10000000-0000-0000-0000-00000000b001', 'Tenant B');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-00000000a001', '10000000-0000-0000-0000-00000000a001', 'owner',
   '00000000-0000-0000-0000-00000000a001'),
  ('00000000-0000-0000-0000-00000000a002', '10000000-0000-0000-0000-00000000a001', 'member',
   '00000000-0000-0000-0000-00000000a001'),
  ('00000000-0000-0000-0000-00000000b001', '10000000-0000-0000-0000-00000000b001', 'owner',
   '00000000-0000-0000-0000-00000000b001');

insert into public.warehouses (id, tenant_id, name, created_by) values
  ('30000000-0000-0000-0000-00000000a001', '10000000-0000-0000-0000-00000000a001', 'Bodega A',
   '00000000-0000-0000-0000-00000000a001'),
  ('30000000-0000-0000-0000-00000000b001', '10000000-0000-0000-0000-00000000b001', 'Bodega B',
   '00000000-0000-0000-0000-00000000b001');

insert into public.products (id, tenant_id, sku, name, cost, price, created_by) values
  ('40000000-0000-0000-0000-00000000a001', '10000000-0000-0000-0000-00000000a001', 'SKU-A1',
   'Producto A1', 100, 200, '00000000-0000-0000-0000-00000000a001'),
  ('40000000-0000-0000-0000-00000000a002', '10000000-0000-0000-0000-00000000a001', 'SKU-A2',
   'Producto A2', 50, 90, '00000000-0000-0000-0000-00000000a001'),
  ('40000000-0000-0000-0000-00000000b001', '10000000-0000-0000-0000-00000000b001', 'SKU-B1',
   'Producto B1', 300, 400, '00000000-0000-0000-0000-00000000b001');

-- Ingresar stock para que se pueda vender
insert into public.stock_movements (tenant_id, product_id, warehouse_id, kind, qty, unit_cost, created_by) values
  ('10000000-0000-0000-0000-00000000a001', '40000000-0000-0000-0000-00000000a001', '30000000-0000-0000-0000-00000000a001', 'in', 10, 100, '00000000-0000-0000-0000-00000000a001'),
  ('10000000-0000-0000-0000-00000000a001', '40000000-0000-0000-0000-00000000a002', '30000000-0000-0000-0000-00000000a001', 'in', 5, 50, '00000000-0000-0000-0000-00000000a001');

-- Ventas en diferentes estados
insert into public.sales (id, tenant_id, status, subtotal, tax, total, created_by) values
  ('50000000-0000-0000-0000-00000000a001', '10000000-0000-0000-0000-00000000a001',
   'draft', 200, 0, 200, '00000000-0000-0000-0000-00000000a001'),
  ('50000000-0000-0000-0000-00000000a002', '10000000-0000-0000-0000-00000000a001',
   'draft', 90, 0, 90, '00000000-0000-0000-0000-00000000a001'),
  ('50000000-0000-0000-0000-00000000a003', '10000000-0000-0000-0000-00000000a001',
   'confirmed', 200, 0, 200, '00000000-0000-0000-0000-00000000a001'),
  ('50000000-0000-0000-0000-00000000a004', '10000000-0000-0000-0000-00000000a001',
   'cancelled', 200, 0, 200, '00000000-0000-0000-0000-00000000a001'),
  ('50000000-0000-0000-0000-00000000b001', '10000000-0000-0000-0000-00000000b001',
   'draft', 400, 0, 400, '00000000-0000-0000-0000-00000000b001');

-- Venta A1: 2 ítems, stock suficiente
insert into public.sale_items (id, tenant_id, sale_id, product_id, qty, unit_price) values
  ('60000000-0000-0000-0000-00000000a001', '10000000-0000-0000-0000-00000000a001',
   '50000000-0000-0000-0000-00000000a001', '40000000-0000-0000-0000-00000000a001', 1, 200),
  ('60000000-0000-0000-0000-00000000a002', '10000000-0000-0000-0000-00000000a001',
   '50000000-0000-0000-0000-00000000a001', '40000000-0000-0000-0000-00000000a002', 2, 90);

-- Venta A2: qty supera stock actual de A2 (5)
insert into public.sale_items (id, tenant_id, sale_id, product_id, qty, unit_price) values
  ('60000000-0000-0000-0000-00000000a003', '10000000-0000-0000-0000-00000000a001',
   '50000000-0000-0000-0000-00000000a002', '40000000-0000-0000-0000-00000000a002', 10, 90);

-- Venta A3 (ya confirmed)
insert into public.sale_items (id, tenant_id, sale_id, product_id, qty, unit_price) values
  ('60000000-0000-0000-0000-00000000a004', '10000000-0000-0000-0000-00000000a001',
   '50000000-0000-0000-0000-00000000a003', '40000000-0000-0000-0000-00000000a001', 1, 200);

-- Venta A4 (cancelled)
insert into public.sale_items (id, tenant_id, sale_id, product_id, qty, unit_price) values
  ('60000000-0000-0000-0000-00000000a005', '10000000-0000-0000-0000-00000000a001',
   '50000000-0000-0000-0000-00000000a004', '40000000-0000-0000-0000-00000000a001', 1, 200);

-- Venta B1
insert into public.sale_items (id, tenant_id, sale_id, product_id, qty, unit_price) values
  ('60000000-0000-0000-0000-00000000b001', '10000000-0000-0000-0000-00000000b001',
   '50000000-0000-0000-0000-00000000b001', '40000000-0000-0000-0000-00000000b001', 1, 400);

-- === Simular al member del tenant A ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000a002", "role": "authenticated"}';

-- === C1 y C2: confirmación feliz ===
select lives_ok(
  $$select public.confirm_sale(
      '50000000-0000-0000-0000-00000000a001'::uuid,
      '30000000-0000-0000-0000-00000000a001'::uuid
  )$$,
  'C1: member confirma una venta draft sin fallar');

select is(
  (select status from public.sales where id = '50000000-0000-0000-0000-00000000a001'),
  'confirmed', 'C1: la venta pasa a confirmed');

select isnt(
  (select issued_at from public.sales where id = '50000000-0000-0000-0000-00000000a001'),
  null, 'C1: issued_at queda fijado');

select is(
  (select count(*)::int from public.stock_movements
   where ref_type = 'sale' and ref_id = '50000000-0000-0000-0000-00000000a001'),
  2, 'C2: se crea un movimiento out por cada ítem (2)');

select is(
  (select sum(qty) from public.stock_movements
   where ref_type = 'sale' and ref_id = '50000000-0000-0000-0000-00000000a001'),
  -3.000::numeric, 'C2: la suma de qty de los movimientos coincide con los ítems (1+2)');

select is(
  (select unit_cost from public.sale_items where id = '60000000-0000-0000-0000-00000000a001'),
  100.00::numeric, 'C2: unit_cost del ítem 1 se congela correctamente');

select is(
  (select unit_cost from public.sale_items where id = '60000000-0000-0000-0000-00000000a002'),
  50.00::numeric, 'C2: unit_cost del ítem 2 se congela correctamente');

-- === C3: error por falta de stock (venta A2 intenta vender 10, hay 5) ===
select throws_ok(
  $$select public.confirm_sale(
      '50000000-0000-0000-0000-00000000a002'::uuid,
      '30000000-0000-0000-0000-00000000a001'::uuid
  )$$,
  'P0001', 'stock_insufficient', 'C3: falla al confirmar venta con cantidad que excede stock');

select is(
  (select status from public.sales where id = '50000000-0000-0000-0000-00000000a002'),
  'draft', 'C3: venta revertida/mantenida en draft por fallo de stock');

-- === C4: rechazo desde estado diferente a draft ===
select throws_ok(
  $$select public.confirm_sale(
      '50000000-0000-0000-0000-00000000a003'::uuid,
      '30000000-0000-0000-0000-00000000a001'::uuid
  )$$,
  'P0001', 'sale_not_draft', 'C4: rechaza confirmar venta confirmed');

select throws_ok(
  $$select public.confirm_sale(
      '50000000-0000-0000-0000-00000000a004'::uuid,
      '30000000-0000-0000-0000-00000000a001'::uuid
  )$$,
  'P0001', 'sale_not_draft', 'C4: rechaza confirmar venta cancelled');

-- === C5: aislamiento multitenant (bodega ajena o venta ajena) ===
select throws_ok(
  $$select public.confirm_sale(
      '50000000-0000-0000-0000-00000000a002'::uuid,
      '30000000-0000-0000-0000-00000000b001'::uuid
  )$$,
  'P0001', 'warehouse_invalid', 'C5: bodega ajena rechazada');

select throws_ok(
  $$select public.confirm_sale(
      '50000000-0000-0000-0000-00000000b001'::uuid,
      '30000000-0000-0000-0000-00000000a001'::uuid
  )$$,
  'P0001', 'permission_denied', 'C5: venta ajena rechazada');

select * from finish();
rollback;
