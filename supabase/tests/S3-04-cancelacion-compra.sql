-- S3-04 — Cancelación y edición de compra: cancel_purchase, update_purchase
-- Ver specs/S3-04-cancelacion-compra.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

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

-- Órdenes insertadas directamente en distintos estados
insert into public.purchases (id, tenant_id, supplier_id, status, subtotal, tax, total, created_by) values
  ('50000000-0000-0000-0000-00000000a001', '10000000-0000-0000-0000-00000000a001',
   '20000000-0000-0000-0000-00000000a001', 'draft', 100, 0, 100, '00000000-0000-0000-0000-00000000a001'),
  ('50000000-0000-0000-0000-00000000a002', '10000000-0000-0000-0000-00000000a001',
   '20000000-0000-0000-0000-00000000a001', 'ordered', 100, 0, 100, '00000000-0000-0000-0000-00000000a001'),
  ('50000000-0000-0000-0000-00000000a003', '10000000-0000-0000-0000-00000000a001',
   '20000000-0000-0000-0000-00000000a001', 'received', 100, 0, 100, '00000000-0000-0000-0000-00000000a001'),
  ('50000000-0000-0000-0000-00000000a004', '10000000-0000-0000-0000-00000000a001',
   '20000000-0000-0000-0000-00000000a001', 'cancelled', 100, 0, 100, '00000000-0000-0000-0000-00000000a001');

insert into public.purchase_items (tenant_id, purchase_id, product_id, qty, unit_cost) values
  ('10000000-0000-0000-0000-00000000a001', '50000000-0000-0000-0000-00000000a001',
   '40000000-0000-0000-0000-00000000a001', 1, 100),
  ('10000000-0000-0000-0000-00000000a001', '50000000-0000-0000-0000-00000000a002',
   '40000000-0000-0000-0000-00000000a001', 1, 100),
  ('10000000-0000-0000-0000-00000000a001', '50000000-0000-0000-0000-00000000a003',
   '40000000-0000-0000-0000-00000000a001', 1, 100),
  ('10000000-0000-0000-0000-00000000a001', '50000000-0000-0000-0000-00000000a004',
   '40000000-0000-0000-0000-00000000a001', 1, 100);

-- === Simular owner ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000a001", "role": "authenticated"}';

-- === C1: cancel_purchase exitoso (draft y ordered) ===
select lives_ok(
  $$select public.cancel_purchase('50000000-0000-0000-0000-00000000a001'::uuid)$$,
  'C1: admin puede cancelar una orden draft');
select is(
  (select status from public.purchases where id = '50000000-0000-0000-0000-00000000a001'),
  'cancelled', 'C1: la orden draft pasa a cancelled');

select lives_ok(
  $$select public.cancel_purchase('50000000-0000-0000-0000-00000000a002'::uuid)$$,
  'C1: admin puede cancelar una orden ordered');
select is(
  (select status from public.purchases where id = '50000000-0000-0000-0000-00000000a002'),
  'cancelled', 'C1: la orden ordered pasa a cancelled');

-- === C2: cancel_purchase falla en received o ya cancelled ===
select throws_ok(
  $$select public.cancel_purchase('50000000-0000-0000-0000-00000000a003'::uuid)$$,
  'P0001', 'purchase_not_cancellable', 'C2: no se puede cancelar una orden received');

select throws_ok(
  $$select public.cancel_purchase('50000000-0000-0000-0000-00000000a004'::uuid)$$,
  'P0001', 'purchase_not_cancellable', 'C2: no se puede cancelar una orden ya cancelled');

-- Volvemos la orden a001 a draft para probar update_purchase. authenticated solo tiene
-- SELECT sobre purchases (toda mutación pasa por RPC security definer), así que el reset
-- de fixture se hace con el rol de la sesión (postgres/owner de la transacción de test).
reset role;
update public.purchases set status = 'draft' where id = '50000000-0000-0000-0000-00000000a001';
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000a001", "role": "authenticated"}';

-- === C3: update_purchase exitoso en draft ===
select lives_ok(
  $$select public.update_purchase(
      '50000000-0000-0000-0000-00000000a001'::uuid,
      '20000000-0000-0000-0000-00000000a001'::uuid,
      '[{"product_id": "40000000-0000-0000-0000-00000000a001", "qty": 2, "unit_cost": 150, "tax_rate": 0}]'::jsonb,
      'Nota actualizada'
  )$$,
  'C3: admin puede actualizar una orden draft');

select is(
  (select total from public.purchases where id = '50000000-0000-0000-0000-00000000a001'),
  300.00::numeric, 'C3: total recalculado correctamente (2 x 150)');
select is(
  (select note from public.purchases where id = '50000000-0000-0000-0000-00000000a001'),
  'Nota actualizada', 'C3: nota actualizada');
select is(
  (select count(*)::int from public.purchase_items where purchase_id = '50000000-0000-0000-0000-00000000a001'),
  1, 'C3: items reemplazados correctamente (solo hay 1)');

-- === C4: update_purchase falla en received ===
select throws_ok(
  $$select public.update_purchase(
      '50000000-0000-0000-0000-00000000a003'::uuid,
      '20000000-0000-0000-0000-00000000a001'::uuid,
      '[{"product_id": "40000000-0000-0000-0000-00000000a001", "qty": 2, "unit_cost": 150, "tax_rate": 0}]'::jsonb,
      null
  )$$,
  'P0001', 'purchase_not_updatable', 'C4: no se puede editar una orden received');

-- === Simular member ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000a002", "role": "authenticated"}';

-- === C5: member no puede cancelar ni editar ===
select throws_ok(
  $$select public.cancel_purchase('50000000-0000-0000-0000-00000000a001'::uuid)$$,
  'P0001', 'permission_denied', 'C5: member no puede cancelar orden');

select throws_ok(
  $$select public.update_purchase(
      '50000000-0000-0000-0000-00000000a001'::uuid,
      '20000000-0000-0000-0000-00000000a001'::uuid,
      '[{"product_id": "40000000-0000-0000-0000-00000000a001", "qty": 2, "unit_cost": 150, "tax_rate": 0}]'::jsonb,
      null
  )$$,
  'P0001', 'permission_denied', 'C5: member no puede editar orden');

select * from finish();
rollback;
