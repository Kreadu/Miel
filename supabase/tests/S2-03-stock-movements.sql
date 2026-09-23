begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- Fixtures
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000aaa1', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000bbb1', 'owner-b@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-00000000aaa1', 'Tenant A'),
  ('10000000-0000-0000-0000-00000000bbb1', 'Tenant B');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-00000000aaa1', '10000000-0000-0000-0000-00000000aaa1', 'owner', '00000000-0000-0000-0000-00000000aaa1'),
  ('00000000-0000-0000-0000-00000000bbb1', '10000000-0000-0000-0000-00000000bbb1', 'owner', '00000000-0000-0000-0000-00000000bbb1');

insert into public.warehouses (id, tenant_id, name, created_by) values
  ('30000000-0000-0000-0000-00000000aaa1', '10000000-0000-0000-0000-00000000aaa1', 'Bodega A', '00000000-0000-0000-0000-00000000aaa1'),
  ('30000000-0000-0000-0000-00000000bbb1', '10000000-0000-0000-0000-00000000bbb1', 'Bodega B', '00000000-0000-0000-0000-00000000bbb1');

insert into public.products (id, tenant_id, sku, name, cost, price, created_by) values
  ('20000000-0000-0000-0000-00000000aaa1', '10000000-0000-0000-0000-00000000aaa1', 'SKU-A', 'Producto A', 100, 200, '00000000-0000-0000-0000-00000000aaa1'),
  ('20000000-0000-0000-0000-00000000bbb1', '10000000-0000-0000-0000-00000000bbb1', 'SKU-B', 'Producto B', 300, 400, '00000000-0000-0000-0000-00000000bbb1');

-- Simular al usuario A
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-00000000aaa1", "role": "authenticated"}';

-- === C4: RLS previene escritura manual en stock_movements ===
select throws_ok(
  $$insert into public.stock_movements (tenant_id, product_id, warehouse_id, kind, qty, unit_cost, created_by)
    values ('10000000-0000-0000-0000-00000000aaa1', '20000000-0000-0000-0000-00000000aaa1', '30000000-0000-0000-0000-00000000aaa1', 'in', 10, 100, '00000000-0000-0000-0000-00000000aaa1')$$,
  '42501', null, 'C4: RLS deniega insert directo (policy write no existe)');

-- === C2: Registro exitoso de entrada manual ===
select lives_ok(
  $$select public.register_movement(
      '20000000-0000-0000-0000-00000000aaa1', -- product_id
      '30000000-0000-0000-0000-00000000aaa1', -- warehouse_id
      'in', 
      10, 
      100, 
      'manual', 
      null, 
      'entrada inicial'
  )$$,
  'C2: Registrar entrada manual no falla');

select is(
  (select sum(qty) from public.stock_movements where product_id = '20000000-0000-0000-0000-00000000aaa1' and warehouse_id = '30000000-0000-0000-0000-00000000aaa1'),
  10.000::numeric,
  'C2: El stock total sube a 10');

-- === C3: Registro de salida y congelamiento del costo promedio ===
select lives_ok(
  $$select public.register_movement(
      '20000000-0000-0000-0000-00000000aaa1', 
      '30000000-0000-0000-0000-00000000aaa1', 
      'out', 
      4, 
      0, -- unit_cost es ignorado en salidas, la BD lo calcula
      'manual', 
      null, 
      'salida de 4'
  )$$,
  'C3: Registrar salida manual no falla');

select is(
  (select sum(qty) from public.stock_movements where product_id = '20000000-0000-0000-0000-00000000aaa1' and warehouse_id = '30000000-0000-0000-0000-00000000aaa1'),
  6.000::numeric,
  'C3: El stock total baja a 6');

select is(
  (select unit_cost from public.stock_movements where qty = -4),
  100.00::numeric,
  'C3: El costo de la salida se congeló usando el costo promedio ponderado');

-- === C1: Invariante stock no negativo (rechazo de salida mayor al stock) ===
select throws_ok(
  $$select public.register_movement(
      '20000000-0000-0000-0000-00000000aaa1', 
      '30000000-0000-0000-0000-00000000aaa1', 
      'out', 
      10, -- intenta sacar 10, pero solo hay 6 
      0, 
      'manual', 
      null, 
      'salida invalida'
  )$$,
  'P0001', 'stock_insufficient', 'C1: Falla porque dejaría el stock < 0');

select * from finish();
rollback;
