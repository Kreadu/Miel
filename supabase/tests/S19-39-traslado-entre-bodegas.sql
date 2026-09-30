-- S19-39 — transfer_stock: sale de A y entra a B al mismo costo, en una transacción (owner/admin);
-- una bodega con stock no se puede dar de baja.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000019391', 'owner-s1939@test.local'),
  ('00000000-0000-0000-0000-000000019392', 'member-s1939@test.local'),
  ('00000000-0000-0000-0000-000000019393', 'ajeno-s1939@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-000000019391', 'Tenant S19-39'),
  ('10000000-0000-0000-0000-000000019392', 'Tenant ajeno S19-39');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000019391', '10000000-0000-0000-0000-000000019391', 'owner',
   '00000000-0000-0000-0000-000000019391'),
  ('00000000-0000-0000-0000-000000019392', '10000000-0000-0000-0000-000000019391', 'member',
   '00000000-0000-0000-0000-000000019391'),
  ('00000000-0000-0000-0000-000000019393', '10000000-0000-0000-0000-000000019392', 'owner',
   '00000000-0000-0000-0000-000000019393');

insert into public.warehouses (id, tenant_id, name, created_by) values
  ('30000000-0000-0000-0000-000000019391', '10000000-0000-0000-0000-000000019391', 'Cierra',
   '00000000-0000-0000-0000-000000019391'),
  ('30000000-0000-0000-0000-000000019392', '10000000-0000-0000-0000-000000019391', 'Recibe',
   '00000000-0000-0000-0000-000000019391'),
  ('30000000-0000-0000-0000-000000019393', '10000000-0000-0000-0000-000000019392', 'Ajena',
   '00000000-0000-0000-0000-000000019393');

insert into public.products (id, tenant_id, sku, name, cost, price, created_by) values
  ('40000000-0000-0000-0000-000000019391', '10000000-0000-0000-0000-000000019391', 'S1939',
   'Producto', 12, 20, '00000000-0000-0000-0000-000000019391');

insert into public.stock_movements (tenant_id, product_id, warehouse_id, kind, qty, unit_cost, created_by) values
  ('10000000-0000-0000-0000-000000019391', '40000000-0000-0000-0000-000000019391',
   '30000000-0000-0000-0000-000000019391', 'in', 10, 12, '00000000-0000-0000-0000-000000019391');

create function pg_temp.stock(p_wh uuid) returns int language sql as $$
  select coalesce(sum(qty), 0)::int from public.stock_movements
  where product_id = '40000000-0000-0000-0000-000000019391' and warehouse_id = p_wh
$$;

set local role authenticated;

-- === Un operativo no traslada ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000019392", "role": "authenticated"}';
select throws_ok(
  $$select public.transfer_stock('30000000-0000-0000-0000-000000019391', '30000000-0000-0000-0000-000000019392',
    '[{"product_id": "40000000-0000-0000-0000-000000019391", "qty": 4}]'::jsonb, null)$$,
  'P0001', 'permission_denied', 'un operativo no traslada');

-- === Reglas ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000019391", "role": "authenticated"}';
select throws_ok(
  $$select public.transfer_stock('30000000-0000-0000-0000-000000019391', '30000000-0000-0000-0000-000000019391',
    '[{"product_id": "40000000-0000-0000-0000-000000019391", "qty": 4}]'::jsonb, null)$$,
  'P0001', 'transfer_same_warehouse', 'no a la misma bodega');
select throws_ok(
  $$select public.transfer_stock('30000000-0000-0000-0000-000000019391', '30000000-0000-0000-0000-000000019393',
    '[{"product_id": "40000000-0000-0000-0000-000000019391", "qty": 4}]'::jsonb, null)$$,
  'P0001', 'warehouse_invalid', 'no a una bodega de otra empresa');
select throws_ok(
  $$select public.transfer_stock('30000000-0000-0000-0000-000000019391', '30000000-0000-0000-0000-000000019392',
    '[{"product_id": "40000000-0000-0000-0000-000000019391", "qty": 11}]'::jsonb, null)$$,
  'P0001', 'stock_insufficient', 'no más de lo que hay');
select is(pg_temp.stock('30000000-0000-0000-0000-000000019392'), 0, 'atomicidad: nada entró en la otra');

-- === Una bodega con stock no se da de baja ===
select throws_ok(
  $$update public.warehouses set active = false where id = '30000000-0000-0000-0000-000000019391'$$,
  'P0001', 'warehouse_has_stock', 'con stock no se da de baja');

-- === Caso feliz: trasladar todo ===
select lives_ok(
  $$select public.transfer_stock('30000000-0000-0000-0000-000000019391', '30000000-0000-0000-0000-000000019392',
    '[{"product_id": "40000000-0000-0000-0000-000000019391", "qty": 10}]'::jsonb, 'Cierre')$$,
  'traslada todo');
select results_eq(
  $$select pg_temp.stock('30000000-0000-0000-0000-000000019391'), pg_temp.stock('30000000-0000-0000-0000-000000019392')$$,
  $$values (0, 10)$$,
  'sale de una y entra a la otra');
select is(
  (select unit_cost from public.stock_movements
   where warehouse_id = '30000000-0000-0000-0000-000000019392' and ref_type = 'transfer'),
  12::numeric, 'entra al mismo costo');
select is(
  (select count(distinct ref_id)::int from public.stock_movements where ref_type = 'transfer'),
  1, 'salida y entrada comparten el mismo traslado');
select is((select cost from public.products where id = '40000000-0000-0000-0000-000000019391'),
  12::numeric, 'el costo promedio del producto no cambia');

-- === Sin stock ya se puede dar de baja ===
select lives_ok(
  $$update public.warehouses set active = false where id = '30000000-0000-0000-0000-000000019391'$$,
  'vacía, se da de baja');

select * from finish();
rollback;
