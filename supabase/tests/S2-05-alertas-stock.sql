begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- Fixtures: 2 tenants, 1 usuario por tenant (owner), 1 bodega, varios productos
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

insert into public.products (id, tenant_id, sku, name, min_stock, active, created_by) values
  ('20000000-0000-0000-0000-00000000aa11', '10000000-0000-0000-0000-00000000aaa1', 'BAJO-MIN', 'Producto Bajo Mínimo', 10, true, '00000000-0000-0000-0000-00000000aaa1'),
  ('20000000-0000-0000-0000-00000000aa22', '10000000-0000-0000-0000-00000000aaa1', 'SOBRE-MIN', 'Producto Sobre Mínimo', 10, true, '00000000-0000-0000-0000-00000000aaa1'),
  ('20000000-0000-0000-0000-00000000aa33', '10000000-0000-0000-0000-00000000aaa1', 'SIN-MIN', 'Producto Sin Mínimo', 0, true, '00000000-0000-0000-0000-00000000aaa1'),
  ('20000000-0000-0000-0000-00000000aa44', '10000000-0000-0000-0000-00000000aaa1', 'ARCHIVADO', 'Producto Archivado', 10, false, '00000000-0000-0000-0000-00000000aaa1'),
  ('20000000-0000-0000-0000-00000000bb11', '10000000-0000-0000-0000-00000000bbb1', 'TENANT-B', 'Producto Tenant B', 10, true, '00000000-0000-0000-0000-00000000bbb1');

-- Simular al owner A y crear movimientos
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-00000000aaa1", "role": "authenticated"}';

-- Movimiento: 5 unidades al producto bajo mínimo (min = 10)
select public.register_movement('20000000-0000-0000-0000-00000000aa11', '30000000-0000-0000-0000-00000000aaa1', 'in', 5, 100, 'manual', null, null);

-- Movimiento: 15 unidades al producto sobre mínimo (min = 10)
select public.register_movement('20000000-0000-0000-0000-00000000aa22', '30000000-0000-0000-0000-00000000aaa1', 'in', 15, 100, 'manual', null, null);

-- Movimiento: 5 unidades al producto archivado (min = 10, pero active = false)
select public.register_movement('20000000-0000-0000-0000-00000000aa44', '30000000-0000-0000-0000-00000000aaa1', 'in', 5, 100, 'manual', null, null);

-- Tests

select is(
  (select count(*)::int from public.low_stock_alerts where product_id = '20000000-0000-0000-0000-00000000aa11'),
  1,
  'C1/C2: Producto bajo mínimo aparece en alertas'
);

select is(
  (select count(*)::int from public.low_stock_alerts where product_id = '20000000-0000-0000-0000-00000000aa22'),
  0,
  'C3: Producto sobre mínimo no aparece en alertas'
);

select is(
  (select count(*)::int from public.low_stock_alerts where product_id = '20000000-0000-0000-0000-00000000aa33'),
  0,
  'Caso Borde: Producto con min_stock=0 no aparece (así tenga 0 en stock)'
);

select is(
  (select count(*)::int from public.low_stock_alerts where product_id = '20000000-0000-0000-0000-00000000aa44'),
  0,
  'C4: Producto archivado no aparece en alertas'
);

select is(
  (select count(*)::int from public.low_stock_alerts where tenant_id = '10000000-0000-0000-0000-00000000bbb1'),
  0,
  'C5: Aislamiento - Tenant A no ve alertas del Tenant B'
);

select * from finish();
rollback;
