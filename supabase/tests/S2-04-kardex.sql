begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Fixtures: 2 tenants, 2 usuarios por tenant (owner y member), 1 bodega, 1 producto por tenant
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000aaa1', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000aaa2', 'member-a@test.local'),
  ('00000000-0000-0000-0000-00000000bbb1', 'owner-b@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-00000000aaa1', 'Tenant A'),
  ('10000000-0000-0000-0000-00000000bbb1', 'Tenant B');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-00000000aaa1', '10000000-0000-0000-0000-00000000aaa1', 'owner', '00000000-0000-0000-0000-00000000aaa1'),
  ('00000000-0000-0000-0000-00000000aaa2', '10000000-0000-0000-0000-00000000aaa1', 'member', '00000000-0000-0000-0000-00000000aaa1'),
  ('00000000-0000-0000-0000-00000000bbb1', '10000000-0000-0000-0000-00000000bbb1', 'owner', '00000000-0000-0000-0000-00000000bbb1');

insert into public.warehouses (id, tenant_id, name, created_by) values
  ('30000000-0000-0000-0000-00000000aaa1', '10000000-0000-0000-0000-00000000aaa1', 'Bodega A', '00000000-0000-0000-0000-00000000aaa1'),
  ('30000000-0000-0000-0000-00000000bbb1', '10000000-0000-0000-0000-00000000bbb1', 'Bodega B', '00000000-0000-0000-0000-00000000bbb1');

insert into public.products (id, tenant_id, sku, name, cost, price, created_by) values
  ('20000000-0000-0000-0000-00000000aaa1', '10000000-0000-0000-0000-00000000aaa1', 'SKU-A', 'Producto A', 10, 20, '00000000-0000-0000-0000-00000000aaa1'),
  ('20000000-0000-0000-0000-00000000bbb1', '10000000-0000-0000-0000-00000000bbb1', 'SKU-B', 'Producto B', 30, 40, '00000000-0000-0000-0000-00000000bbb1');

-- Simular al owner A y crear movimientos
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-00000000aaa1", "role": "authenticated"}';

-- Movimiento 1: Entrada de 10 unidades a $100
select public.register_movement(
  '20000000-0000-0000-0000-00000000aaa1', '30000000-0000-0000-0000-00000000aaa1', 'in', 10, 100, 'manual', null, null
);
reset role;
update public.stock_movements set created_at = '2020-01-01 10:00:00' where qty = 10;
set local role authenticated; set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-00000000aaa1", "role": "authenticated"}';

-- Movimiento 2: Salida de 4 unidades (costo calculado autom. a $100)
select public.register_movement(
  '20000000-0000-0000-0000-00000000aaa1', '30000000-0000-0000-0000-00000000aaa1', 'out', 4, 0, 'manual', null, null
);
reset role;
update public.stock_movements set created_at = '2020-01-02 10:00:00' where qty = -4;
set local role authenticated; set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-00000000aaa1", "role": "authenticated"}';

-- Movimiento 3: Entrada de 4 unidades a $150
-- Stock previo: 6 unids a $100 (Total $600) + 4 unids a $150 (Total $600) = 10 unids a $1200. Avg Cost = $120
select public.register_movement(
  '20000000-0000-0000-0000-00000000aaa1', '30000000-0000-0000-0000-00000000aaa1', 'in', 4, 150, 'manual', null, null
);
reset role;
update public.stock_movements set created_at = '2020-01-03 10:00:00' where qty = 4 and unit_cost = 150;
set local role authenticated; set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-00000000aaa1", "role": "authenticated"}';

-- Test C1: current_stock
select is(
  (select total_qty from public.current_stock where product_id = '20000000-0000-0000-0000-00000000aaa1'),
  10.000::numeric,
  'C1: current_stock muestra 10 unidades totales para owner'
);

select is(
  (select total_value from public.current_stock where product_id = '20000000-0000-0000-0000-00000000aaa1'),
  1200.00::numeric,
  'C1: current_stock muestra valor total de $1200 para owner'
);

-- Test C2: kardex window functions
select is(
  (select accumulated_qty from public.kardex where product_id = '20000000-0000-0000-0000-00000000aaa1' order by date asc, movement_id asc limit 1),
  10.000::numeric,
  'C2: kardex primer paso acumula 10 qty'
);

select is(
  (select average_cost from public.kardex where product_id = '20000000-0000-0000-0000-00000000aaa1' order by date desc, movement_id desc limit 1),
  120.000000::numeric,
  'C2: kardex último paso tiene costo promedio de $120'
);

-- Simular al member A
reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-00000000aaa2", "role": "authenticated"}';

-- Test C3: member ve cantidades pero no costos
select is(
  (select total_qty from public.current_stock where product_id = '20000000-0000-0000-0000-00000000aaa1'),
  10.000::numeric,
  'C3: current_stock muestra cantidad al member'
);

select is(
  (select total_value from public.current_stock where product_id = '20000000-0000-0000-0000-00000000aaa1'),
  null,
  'C3: current_stock oculta (es null) total_value al member'
);

select is(
  (select count(*)::int from public.kardex where product_id = '20000000-0000-0000-0000-00000000aaa1' and unit_cost is not null),
  0,
  'C3: kardex oculta (es null) todos los unit_cost al member'
);

select is(
  (select count(*)::int from public.kardex where product_id = '20000000-0000-0000-0000-00000000aaa1' and accumulated_value is not null),
  0,
  'C3: kardex oculta (es null) todos los accumulated_value al member'
);

select is(
  (select count(*)::int from public.kardex where product_id = '20000000-0000-0000-0000-00000000aaa1' and average_cost is not null),
  0,
  'C3: kardex oculta (es null) todos los average_cost al member'
);

-- Test C4: Aislamiento (A no ve a B)
select is(
  (select count(*)::int from public.current_stock where tenant_id = '10000000-0000-0000-0000-00000000bbb1'),
  0,
  'C4: current_stock aisla y A no ve datos de B'
);

select is(
  (select count(*)::int from public.kardex where tenant_id = '10000000-0000-0000-0000-00000000bbb1'),
  0,
  'C4: kardex aisla y A no ve datos de B'
);

-- Test removido porque el CASE ya enmascara la columna a null, no lanza 42501.

select * from finish();
rollback;
