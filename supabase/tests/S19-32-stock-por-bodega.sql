-- S19-32 — set_product_stock: fija el stock por bodega registrando ajustes.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000032a01', 'owner-a-s1932@test.local'),
  ('00000000-0000-0000-0000-000000032a02', 'member-a-s1932@test.local'),
  ('00000000-0000-0000-0000-000000032b01', 'owner-b-s1932@test.local');
insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-000000032a01', 'Tenant A S19-32'),
  ('10000000-0000-0000-0000-000000032b01', 'Tenant B S19-32');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000032a01', '10000000-0000-0000-0000-000000032a01', 'owner',
   '00000000-0000-0000-0000-000000032a01'),
  ('00000000-0000-0000-0000-000000032a02', '10000000-0000-0000-0000-000000032a01', 'member',
   '00000000-0000-0000-0000-000000032a01'),
  ('00000000-0000-0000-0000-000000032b01', '10000000-0000-0000-0000-000000032b01', 'owner',
   '00000000-0000-0000-0000-000000032b01');
insert into public.warehouses (id, tenant_id, name, created_by) values
  ('20000000-0000-0000-0000-000000032a01', '10000000-0000-0000-0000-000000032a01', 'Principal',
   '00000000-0000-0000-0000-000000032a01'),
  ('20000000-0000-0000-0000-000000032a02', '10000000-0000-0000-0000-000000032a01', 'Centro',
   '00000000-0000-0000-0000-000000032a01'),
  ('20000000-0000-0000-0000-000000032b01', '10000000-0000-0000-0000-000000032b01', 'Ajena',
   '00000000-0000-0000-0000-000000032b01');
insert into public.products (id, tenant_id, sku, name, kind, cost, created_by) values
  ('40000000-0000-0000-0000-000000032a01', '10000000-0000-0000-0000-000000032a01', 'S1932',
   'Miel', 'resale', 100, '00000000-0000-0000-0000-000000032a01');

create or replace function pg_temp.stock_at(w uuid) returns numeric language sql as $$
  select coalesce(sum(qty), 0) from public.stock_movements
  where product_id = '40000000-0000-0000-0000-000000032a01' and warehouse_id = w
$$;

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000032a01", "role": "authenticated"}';

-- === C1: fija stock en dos bodegas ===
select is(
  public.set_product_stock('40000000-0000-0000-0000-000000032a01', '[
    {"warehouse_id": "20000000-0000-0000-0000-000000032a01", "qty": 10},
    {"warehouse_id": "20000000-0000-0000-0000-000000032a02", "qty": 4}]'::jsonb),
  2, 'C1: dos ajustes');
select is(pg_temp.stock_at('20000000-0000-0000-0000-000000032a01'), 10::numeric, 'C1: Principal = 10');
select is(pg_temp.stock_at('20000000-0000-0000-0000-000000032a02'), 4::numeric, 'C1: Centro = 4');

-- === C2: bajar a 6 y dejar igual la otra → un solo ajuste negativo ===
select is(
  public.set_product_stock('40000000-0000-0000-0000-000000032a01', '[
    {"warehouse_id": "20000000-0000-0000-0000-000000032a01", "qty": 6},
    {"warehouse_id": "20000000-0000-0000-0000-000000032a02", "qty": 4}]'::jsonb),
  1, 'C2: solo cambia la que cambió');
select is(pg_temp.stock_at('20000000-0000-0000-0000-000000032a01'), 6::numeric, 'C2: Principal = 6');

-- === C3: negativo rechazado, y atomicidad (la primera bodega no queda cambiada) ===
select throws_ok(
  $$select public.set_product_stock('40000000-0000-0000-0000-000000032a01', '[
    {"warehouse_id": "20000000-0000-0000-0000-000000032a01", "qty": 1},
    {"warehouse_id": "20000000-0000-0000-0000-000000032a02", "qty": -1}]'::jsonb)$$,
  'P0001', 'stock_negative', 'C3: cantidad negativa rechazada');
select is(pg_temp.stock_at('20000000-0000-0000-0000-000000032a01'), 6::numeric,
  'C3: atomicidad — Principal sigue en 6');

-- === C4: bodega de otra empresa rechazada ===
select throws_ok(
  $$select public.set_product_stock('40000000-0000-0000-0000-000000032a01',
    '[{"warehouse_id": "20000000-0000-0000-0000-000000032b01", "qty": 5}]'::jsonb)$$,
  'P0001', 'warehouse_invalid', 'C4: bodega ajena');

-- === C5: member no puede ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000032a02", "role": "authenticated"}';
select throws_ok(
  $$select public.set_product_stock('40000000-0000-0000-0000-000000032a01',
    '[{"warehouse_id": "20000000-0000-0000-0000-000000032a01", "qty": 50}]'::jsonb)$$,
  'P0001', 'permission_denied', 'C5: member rechazado');

select * from finish();
rollback;
