-- S19-34 — inventory_history: ítems con movimiento en el rango, stock al final del rango.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000034a01', 'owner-a-s1934@test.local'),
  ('00000000-0000-0000-0000-000000034a02', 'member-a-s1934@test.local'),
  ('00000000-0000-0000-0000-000000034b01', 'owner-b-s1934@test.local');
insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-000000034a01', 'Tenant A S19-34'),
  ('10000000-0000-0000-0000-000000034b01', 'Tenant B S19-34');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000034a01', '10000000-0000-0000-0000-000000034a01', 'owner',
   '00000000-0000-0000-0000-000000034a01'),
  ('00000000-0000-0000-0000-000000034a02', '10000000-0000-0000-0000-000000034a01', 'member',
   '00000000-0000-0000-0000-000000034a01'),
  ('00000000-0000-0000-0000-000000034b01', '10000000-0000-0000-0000-000000034b01', 'owner',
   '00000000-0000-0000-0000-000000034b01');
insert into public.warehouses (id, tenant_id, name, created_by) values
  ('20000000-0000-0000-0000-000000034a01', '10000000-0000-0000-0000-000000034a01', 'W1',
   '00000000-0000-0000-0000-000000034a01'),
  ('20000000-0000-0000-0000-000000034a02', '10000000-0000-0000-0000-000000034a01', 'W2',
   '00000000-0000-0000-0000-000000034a01');
insert into public.products (id, tenant_id, sku, name, kind, inventory, cost, price, created_by) values
  ('40000000-0000-0000-0000-000000034a01', '10000000-0000-0000-0000-000000034a01', 'P1', 'Miel',
   'resale', 'productos', 100, 150, '00000000-0000-0000-0000-000000034a01'),
  ('40000000-0000-0000-0000-000000034a02', '10000000-0000-0000-0000-000000034a01', 'M1', 'Cera',
   'raw', 'materias_primas', 10, 0, '00000000-0000-0000-0000-000000034a01');
insert into public.stock_movements (tenant_id, product_id, warehouse_id, kind, qty, unit_cost, created_by, created_at) values
  ('10000000-0000-0000-0000-000000034a01', '40000000-0000-0000-0000-000000034a01', '20000000-0000-0000-0000-000000034a01',
   'in', 10, 100, '00000000-0000-0000-0000-000000034a01', '2026-01-05 12:00-05'),
  ('10000000-0000-0000-0000-000000034a01', '40000000-0000-0000-0000-000000034a01', '20000000-0000-0000-0000-000000034a01',
   'out', -3, 100, '00000000-0000-0000-0000-000000034a01', '2026-02-10 12:00-05'),
  ('10000000-0000-0000-0000-000000034a01', '40000000-0000-0000-0000-000000034a01', '20000000-0000-0000-0000-000000034a02',
   'in', 4, 100, '00000000-0000-0000-0000-000000034a01', '2026-02-15 12:00-05'),
  ('10000000-0000-0000-0000-000000034a01', '40000000-0000-0000-0000-000000034a02', '20000000-0000-0000-0000-000000034a01',
   'in', 8, 10, '00000000-0000-0000-0000-000000034a01', '2026-02-12 12:00-05');

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000034a01", "role": "authenticated"}';

-- === C1: febrero, productos → 2 filas (W1 con stock al 28/02 = 7, W2 = 4); sin materias primas ===
select is(
  (select count(*)::int from public.inventory_history('productos', '2026-02-01', '2026-02-28')),
  2, 'C1: dos filas en febrero, solo del inventario de productos');
select is(
  (select stock from public.inventory_history('productos', '2026-02-01', '2026-02-28') where warehouse_name = 'W1'),
  7::numeric, 'C1: W1 = 10 - 3 al final de febrero');

-- === C2: enero → solo W1 con el stock de ese momento (10) ===
select is(
  (select stock from public.inventory_history('productos', '2026-01-01', '2026-01-31')),
  10::numeric, 'C2: stock al 31/01 no incluye movimientos posteriores');

-- === C3: sin movimientos en el rango → nada ===
select is(
  (select count(*)::int from public.inventory_history('productos', '2026-03-01', '2026-03-31')),
  0, 'C3: marzo sin movimientos');

-- === C4: filtro por bodega ===
select is(
  (select count(*)::int from public.inventory_history('productos', '2026-02-01', '2026-02-28',
    '20000000-0000-0000-0000-000000034a02')),
  1, 'C4: solo W2');

-- === C5: costo y precio para owner ===
select is(
  (select cost::text || '|' || price::text from public.inventory_history('productos', '2026-02-01', '2026-02-28')
   where warehouse_name = 'W2'),
  '100.00|150.00', 'C5: owner ve costo y precio');

-- === C6: member no ve el costo ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000034a02", "role": "authenticated"}';
select ok(
  (select bool_and(cost is null) from public.inventory_history('productos', '2026-02-01', '2026-02-28')),
  'C6: member ve el costo enmascarado');

-- === C7: aislamiento ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000034b01", "role": "authenticated"}';
select is(
  (select count(*)::int from public.inventory_history('productos', '2026-01-01', '2026-12-31')),
  0, 'C7: otra empresa no ve nada');

select * from finish();
rollback;
