-- S15-01 — receive_purchase alimenta supplier_products al recibir (upsert). Cubre: alta nueva,
-- producto repetido en la misma orden (riesgo 21000 sin distinct), recepción posterior actualiza
-- last_purchased_at sin duplicar, preexistencia manual se conserva, aislamiento de tenant.
-- Ver specs/S15-01-catalogo-por-proveedor.md. No modifica S3-03-receive-purchase.sql.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Fixtures: tenant A (owner) y tenant B (owner), bodegas, productos, proveedores, órdenes.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a001', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000b001', 'owner-b@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-00000000a001', 'Tenant A'),
  ('10000000-0000-0000-0000-00000000b001', 'Tenant B');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-00000000a001', '10000000-0000-0000-0000-00000000a001', 'owner',
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

-- Órdenes: A1 (feliz, 2 ítems distintos), A2 (mismo producto en 2 ítems, riesgo 21000),
-- A3 (asociación manual preexistente, para verificar que se actualiza sin duplicar),
-- A4 (segunda orden del mismo par A1-producto1, para C-idempotencia), B1 (aislamiento).
insert into public.purchases (id, tenant_id, supplier_id, status, issued_at, created_by) values
  ('50000000-0000-0000-0000-00000000a001', '10000000-0000-0000-0000-00000000a001',
   '20000000-0000-0000-0000-00000000a001', 'ordered', now(), '00000000-0000-0000-0000-00000000a001'),
  ('50000000-0000-0000-0000-00000000a002', '10000000-0000-0000-0000-00000000a001',
   '20000000-0000-0000-0000-00000000a001', 'ordered', now(), '00000000-0000-0000-0000-00000000a001'),
  ('50000000-0000-0000-0000-00000000a004', '10000000-0000-0000-0000-00000000a001',
   '20000000-0000-0000-0000-00000000a001', 'ordered', now(), '00000000-0000-0000-0000-00000000a001'),
  ('50000000-0000-0000-0000-00000000b001', '10000000-0000-0000-0000-00000000b001',
   '20000000-0000-0000-0000-00000000b001', 'ordered', now(), '00000000-0000-0000-0000-00000000b001');

insert into public.purchase_items (tenant_id, purchase_id, product_id, qty, unit_cost) values
  -- A1: feliz, dos productos distintos.
  ('10000000-0000-0000-0000-00000000a001', '50000000-0000-0000-0000-00000000a001',
   '40000000-0000-0000-0000-00000000a001', 5, 100),
  ('10000000-0000-0000-0000-00000000a001', '50000000-0000-0000-0000-00000000a001',
   '40000000-0000-0000-0000-00000000a002', 3, 50),
  -- A2: el MISMO producto en dos ítems (riesgo del 21000 sin select distinct).
  ('10000000-0000-0000-0000-00000000a001', '50000000-0000-0000-0000-00000000a002',
   '40000000-0000-0000-0000-00000000a001', 1, 100),
  ('10000000-0000-0000-0000-00000000a001', '50000000-0000-0000-0000-00000000a002',
   '40000000-0000-0000-0000-00000000a001', 2, 100),
  -- A4: segunda orden del mismo proveedor+producto que A1, para idempotencia/actualización.
  ('10000000-0000-0000-0000-00000000a001', '50000000-0000-0000-0000-00000000a004',
   '40000000-0000-0000-0000-00000000a001', 1, 100),
  -- B1: aislamiento.
  ('10000000-0000-0000-0000-00000000b001', '50000000-0000-0000-0000-00000000b001',
   '40000000-0000-0000-0000-00000000b001', 1, 300);

-- Asociación manual preexistente para el producto A2 con Proveedor A, sin recepción previa
-- (last_purchased_at null) — recibir A1 debe rellenarlo sin duplicar la fila.
insert into public.supplier_products (tenant_id, supplier_id, product_id, created_by) values
  ('10000000-0000-0000-0000-00000000a001', '20000000-0000-0000-0000-00000000a001',
   '40000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-00000000a001');

-- === Simular al owner del tenant A ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000a001", "role": "authenticated"}';

-- C1: recibir A1 (feliz) crea la relación para el producto nuevo (A1) y actualiza la
-- preexistente (A2) sin duplicarla.
select lives_ok(
  $$select public.receive_purchase(
      '50000000-0000-0000-0000-00000000a001'::uuid,
      '30000000-0000-0000-0000-00000000a001'::uuid
  )$$,
  'C1: recibir A1 no falla');

select is(
  (select count(*)::int from public.supplier_products
   where tenant_id = '10000000-0000-0000-0000-00000000a001'
     and supplier_id = '20000000-0000-0000-0000-00000000a001'),
  2, 'C1: quedan exactamente 2 filas (producto A1 nuevo + A2 actualizada, sin duplicar)');

select isnt(
  (select last_purchased_at from public.supplier_products
   where supplier_id = '20000000-0000-0000-0000-00000000a001'
     and product_id = '40000000-0000-0000-0000-00000000a002'),
  null, 'C1: la asociación manual preexistente (A2) gana last_purchased_at al recibir');

-- C2: producto repetido en dos ítems de la MISMA orden (A2) no revienta con 21000 y no duplica.
select lives_ok(
  $$select public.receive_purchase(
      '50000000-0000-0000-0000-00000000a002'::uuid,
      '30000000-0000-0000-0000-00000000a001'::uuid
  )$$,
  'C2: recibir una orden con el mismo producto en 2 ítems no falla (21000)');

select is(
  (select count(*)::int from public.supplier_products
   where supplier_id = '20000000-0000-0000-0000-00000000a001'
     and product_id = '40000000-0000-0000-0000-00000000a001'),
  1, 'C2: el producto repetido en la orden sigue teniendo 1 sola fila en supplier_products');

-- C3: recibir una segunda orden del mismo par proveedor+producto actualiza last_purchased_at
-- sin duplicar (idempotencia real, no una segunda recepción de la MISMA orden — eso ya lo
-- rechaza purchase_not_ordered, cubierto en S3-03).
select is(
  (select count(*)::int from public.supplier_products
   where supplier_id = '20000000-0000-0000-0000-00000000a001'
     and product_id = '40000000-0000-0000-0000-00000000a001'),
  1, 'C3 (previo): sigue habiendo 1 fila antes de la segunda recepción del mismo par');

select lives_ok(
  $$select public.receive_purchase(
      '50000000-0000-0000-0000-00000000a004'::uuid,
      '30000000-0000-0000-0000-00000000a001'::uuid
  )$$,
  'C3: recibir una segunda orden del mismo proveedor+producto no falla');

select is(
  (select count(*)::int from public.supplier_products
   where supplier_id = '20000000-0000-0000-0000-00000000a001'
     and product_id = '40000000-0000-0000-0000-00000000a001'),
  1, 'C3: sigue habiendo 1 sola fila tras la segunda recepción (sin duplicar)');

-- C4: aislamiento — recibir la orden de otro tenant sigue rechazada y no deja filas nuevas.
select throws_ok(
  $$select public.receive_purchase(
      '50000000-0000-0000-0000-00000000b001'::uuid,
      '30000000-0000-0000-0000-00000000a001'::uuid
  )$$,
  'P0001', 'permission_denied', 'C4: recibir orden de otro tenant sigue rechazada');

select * from finish();
rollback;
