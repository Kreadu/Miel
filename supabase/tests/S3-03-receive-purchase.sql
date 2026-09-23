-- S3-03 — Recepción de compra: receive_purchase (orden ordered -> received + un
-- stock_movement 'in' por ítem, vía register_movement). Ver specs/S3-03-recepcion-compra.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- Fixtures: tenant A (owner + member) y tenant B (owner), bodegas, productos, proveedores.
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

insert into public.suppliers (id, tenant_id, name, created_by) values
  ('20000000-0000-0000-0000-00000000a001', '10000000-0000-0000-0000-00000000a001',
   'Proveedor A', '00000000-0000-0000-0000-00000000a001'),
  ('20000000-0000-0000-0000-00000000b001', '10000000-0000-0000-0000-00000000b001',
   'Proveedor B', '00000000-0000-0000-0000-00000000b001');

-- Órdenes insertadas directamente (rol postgres bypasa RLS) en distintos estados.
insert into public.purchases (id, tenant_id, supplier_id, status, issued_at, created_by) values
  ('50000000-0000-0000-0000-00000000a001', '10000000-0000-0000-0000-00000000a001',
   '20000000-0000-0000-0000-00000000a001', 'ordered', now(), '00000000-0000-0000-0000-00000000a001'),
  ('50000000-0000-0000-0000-00000000a002', '10000000-0000-0000-0000-00000000a001',
   '20000000-0000-0000-0000-00000000a001', 'ordered', now(), '00000000-0000-0000-0000-00000000a001'),
  ('50000000-0000-0000-0000-00000000a003', '10000000-0000-0000-0000-00000000a001',
   '20000000-0000-0000-0000-00000000a001', 'draft', null, '00000000-0000-0000-0000-00000000a001'),
  ('50000000-0000-0000-0000-00000000a004', '10000000-0000-0000-0000-00000000a001',
   '20000000-0000-0000-0000-00000000a001', 'cancelled', now(), '00000000-0000-0000-0000-00000000a001'),
  ('50000000-0000-0000-0000-00000000b001', '10000000-0000-0000-0000-00000000b001',
   '20000000-0000-0000-0000-00000000b001', 'ordered', now(), '00000000-0000-0000-0000-00000000b001');

insert into public.purchase_items (tenant_id, purchase_id, product_id, qty, unit_cost) values
  ('10000000-0000-0000-0000-00000000a001', '50000000-0000-0000-0000-00000000a001',
   '40000000-0000-0000-0000-00000000a001', 5, 100),
  ('10000000-0000-0000-0000-00000000a001', '50000000-0000-0000-0000-00000000a001',
   '40000000-0000-0000-0000-00000000a002', 3, 50),
  ('10000000-0000-0000-0000-00000000a001', '50000000-0000-0000-0000-00000000a002',
   '40000000-0000-0000-0000-00000000a001', 2, 100),
  ('10000000-0000-0000-0000-00000000a001', '50000000-0000-0000-0000-00000000a003',
   '40000000-0000-0000-0000-00000000a001', 1, 100),
  ('10000000-0000-0000-0000-00000000a001', '50000000-0000-0000-0000-00000000a004',
   '40000000-0000-0000-0000-00000000a001', 1, 100),
  ('10000000-0000-0000-0000-00000000b001', '50000000-0000-0000-0000-00000000b001',
   '40000000-0000-0000-0000-00000000b001', 1, 300);

-- === Simular al member del tenant A ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000a002", "role": "authenticated"}';

-- === C1: recepción feliz (member, no admin) ===
select lives_ok(
  $$select public.receive_purchase(
      '50000000-0000-0000-0000-00000000a001'::uuid,
      '30000000-0000-0000-0000-00000000a001'::uuid
  )$$,
  'C1: member recibe una orden ordered sin fallar');

select is(
  (select status from public.purchases where id = '50000000-0000-0000-0000-00000000a001'),
  'received', 'C1: la orden pasa a received');

select isnt(
  (select received_at from public.purchases where id = '50000000-0000-0000-0000-00000000a001'),
  null, 'C1: received_at queda fijado');

select is(
  (select count(*)::int from public.stock_movements
   where ref_type = 'purchase' and ref_id = '50000000-0000-0000-0000-00000000a001'),
  2, 'C1: se crea un movimiento in por cada ítem (2)');

select is(
  (select sum(qty) from public.stock_movements
   where ref_type = 'purchase' and ref_id = '50000000-0000-0000-0000-00000000a001'),
  8.000::numeric, 'C1: la suma de qty de los movimientos coincide con los ítems (5+3)');

-- === C2: no recibir dos veces ===
select throws_ok(
  $$select public.receive_purchase(
      '50000000-0000-0000-0000-00000000a001'::uuid,
      '30000000-0000-0000-0000-00000000a001'::uuid
  )$$,
  'P0001', 'purchase_not_ordered', 'C2: recibir la misma orden otra vez es rechazado');

-- === C3: rechazo desde draft/cancelled ===
select throws_ok(
  $$select public.receive_purchase(
      '50000000-0000-0000-0000-00000000a003'::uuid,
      '30000000-0000-0000-0000-00000000a001'::uuid
  )$$,
  'P0001', 'purchase_not_ordered', 'C3: recibir una orden draft es rechazado');

select throws_ok(
  $$select public.receive_purchase(
      '50000000-0000-0000-0000-00000000a004'::uuid,
      '30000000-0000-0000-0000-00000000a001'::uuid
  )$$,
  'P0001', 'purchase_not_ordered', 'C3: recibir una orden cancelled es rechazado');

-- === C4: bodega de otro tenant ===
select throws_ok(
  $$select public.receive_purchase(
      '50000000-0000-0000-0000-00000000a002'::uuid,
      '30000000-0000-0000-0000-00000000b001'::uuid
  )$$,
  'P0001', 'warehouse_invalid', 'C4: bodega de otro tenant es rechazada');

select is(
  (select status from public.purchases where id = '50000000-0000-0000-0000-00000000a002'),
  'ordered', 'C4: la orden A2 sigue ordered tras el rechazo de bodega');

-- === C5: orden ajena (aislamiento) ===
select throws_ok(
  $$select public.receive_purchase(
      '50000000-0000-0000-0000-00000000b001'::uuid,
      '30000000-0000-0000-0000-00000000a001'::uuid
  )$$,
  'P0001', 'permission_denied', 'C5: recibir una orden de otro tenant es rechazado');

-- === C5: atomicidad — ningún movimiento nuevo tras todos los rechazos ===
select is(
  (select count(*)::int from public.stock_movements where ref_type = 'purchase'),
  2, 'C5: el total de movimientos generados por compras sigue siendo 2 tras todos los rechazos');

select * from finish();
rollback;
