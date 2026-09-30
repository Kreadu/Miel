-- S18-10 — Una venta sale de varias bodegas: confirm_sale_allocated (reparto por producto y
-- bodega; solo bodegas que prestan stock) y checkout_counter_sale con reparto; la devolución
-- reintegra a cada bodega lo suyo.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000018a01', 'owner-s1810@test.local'),
  ('00000000-0000-0000-0000-000000018a02', 'ajeno-s1810@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-000000018a01', 'Tenant S18-10'),
  ('10000000-0000-0000-0000-000000018a02', 'Tenant ajeno S18-10');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000018a01', '10000000-0000-0000-0000-000000018a01', 'owner',
   '00000000-0000-0000-0000-000000018a01'),
  ('00000000-0000-0000-0000-000000018a02', '10000000-0000-0000-0000-000000018a02', 'owner',
   '00000000-0000-0000-0000-000000018a02');

-- Cinecultivo (la de la venta), Kreadu (presta stock), Lejana (no presta)
insert into public.warehouses (id, tenant_id, name, lends_stock, created_by) values
  ('30000000-0000-0000-0000-000000018a01', '10000000-0000-0000-0000-000000018a01', 'Cinecultivo', false,
   '00000000-0000-0000-0000-000000018a01'),
  ('30000000-0000-0000-0000-000000018a02', '10000000-0000-0000-0000-000000018a01', 'Kreadu', true,
   '00000000-0000-0000-0000-000000018a01'),
  ('30000000-0000-0000-0000-000000018a03', '10000000-0000-0000-0000-000000018a01', 'Lejana', false,
   '00000000-0000-0000-0000-000000018a01');

insert into public.products (id, tenant_id, sku, name, cost, price, tax_rate, sales_channel, created_by) values
  ('40000000-0000-0000-0000-000000018a01', '10000000-0000-0000-0000-000000018a01', 'S1810',
   'Producto', 10, 100, 0, 'online', '00000000-0000-0000-0000-000000018a01');

insert into public.stock_movements (tenant_id, product_id, warehouse_id, kind, qty, unit_cost, created_by) values
  ('10000000-0000-0000-0000-000000018a01', '40000000-0000-0000-0000-000000018a01',
   '30000000-0000-0000-0000-000000018a01', 'in', 5, 10, '00000000-0000-0000-0000-000000018a01'),
  ('10000000-0000-0000-0000-000000018a01', '40000000-0000-0000-0000-000000018a01',
   '30000000-0000-0000-0000-000000018a02', 'in', 10, 10, '00000000-0000-0000-0000-000000018a01'),
  ('10000000-0000-0000-0000-000000018a01', '40000000-0000-0000-0000-000000018a01',
   '30000000-0000-0000-0000-000000018a03', 'in', 10, 10, '00000000-0000-0000-0000-000000018a01');

insert into public.customers (id, tenant_id, name, created_by) values
  ('50000000-0000-0000-0000-000000018a01', '10000000-0000-0000-0000-000000018a01', 'Cliente',
   '00000000-0000-0000-0000-000000018a01');

create temp table s1810 (label text, sale_id uuid) on commit drop;
grant all on s1810 to authenticated;

create function pg_temp.stock(p_wh uuid) returns int language sql as $$
  select coalesce(sum(qty), 0)::int from public.stock_movements
  where product_id = '40000000-0000-0000-0000-000000018a01' and warehouse_id = p_wh
$$;

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000018a01", "role": "authenticated"}';

insert into s1810 values ('pedido', public.create_sale('10000000-0000-0000-0000-000000018a01',
  '[{"product_id": "40000000-0000-0000-0000-000000018a01", "qty": 10}]'::jsonb,
  '50000000-0000-0000-0000-000000018a01'));

-- === Reglas del reparto ===
select throws_ok(
  $$select public.confirm_sale_allocated((select sale_id from s1810 where label = 'pedido'),
    '30000000-0000-0000-0000-000000018a01',
    '[{"product_id": "40000000-0000-0000-0000-000000018a01", "warehouse_id": "30000000-0000-0000-0000-000000018a01", "qty": 5},
      {"product_id": "40000000-0000-0000-0000-000000018a01", "warehouse_id": "30000000-0000-0000-0000-000000018a03", "qty": 5}]'::jsonb)$$,
  'P0001', 'warehouse_not_lending', 'una bodega no marcada no presta stock');
select throws_ok(
  $$select public.confirm_sale_allocated((select sale_id from s1810 where label = 'pedido'),
    '30000000-0000-0000-0000-000000018a01',
    '[{"product_id": "40000000-0000-0000-0000-000000018a01", "warehouse_id": "30000000-0000-0000-0000-000000018a01", "qty": 5},
      {"product_id": "40000000-0000-0000-0000-000000018a01", "warehouse_id": "30000000-0000-0000-0000-000000018a02", "qty": 4}]'::jsonb)$$,
  'P0001', 'allocation_mismatch', 'el reparto debe sumar lo vendido');
select throws_ok(
  $$select public.confirm_sale_allocated((select sale_id from s1810 where label = 'pedido'),
    '30000000-0000-0000-0000-000000018a01',
    '[{"product_id": "40000000-0000-0000-0000-000000018a01", "warehouse_id": "30000000-0000-0000-0000-000000018a01", "qty": 10}]'::jsonb)$$,
  'P0001', 'stock_insufficient', 'sin stock en la bodega: no confirma');
select results_eq(
  $$select status, pg_temp.stock('30000000-0000-0000-0000-000000018a01') from public.sales
    where id = (select sale_id from s1810 where label = 'pedido')$$,
  $$values ('draft'::text, 5)$$,
  'atomicidad: sigue en borrador y el stock intacto');

-- === Caso feliz: 5 de Cinecultivo + 5 de Kreadu ===
select lives_ok(
  $$select public.confirm_sale_allocated((select sale_id from s1810 where label = 'pedido'),
    '30000000-0000-0000-0000-000000018a01',
    '[{"product_id": "40000000-0000-0000-0000-000000018a01", "warehouse_id": "30000000-0000-0000-0000-000000018a01", "qty": 5},
      {"product_id": "40000000-0000-0000-0000-000000018a01", "warehouse_id": "30000000-0000-0000-0000-000000018a02", "qty": 5}]'::jsonb)$$,
  'confirma repartiendo entre dos bodegas');
select is(pg_temp.stock('30000000-0000-0000-0000-000000018a01'), 0, 'Cinecultivo queda en 0');
select is(pg_temp.stock('30000000-0000-0000-0000-000000018a02'), 5, 'Kreadu queda en 5');
select isnt((select receipt_number from public.sales where id = (select sale_id from s1810 where label = 'pedido')),
  null, 'genera boleta');

-- === Anular devuelve a cada bodega lo suyo ===
select public.cancel_sale((select sale_id from s1810 where label = 'pedido'));
select results_eq(
  $$select pg_temp.stock('30000000-0000-0000-0000-000000018a01'), pg_temp.stock('30000000-0000-0000-0000-000000018a02')$$,
  $$values (5, 10)$$,
  'la anulación reintegra 5 a Cinecultivo y 5 a Kreadu');

-- === Cobrar y entregar con reparto ===
select public.open_cash_session(0, '10000000-0000-0000-0000-000000018a01');
insert into s1810 values ('mostrador', public.checkout_counter_sale(
  '10000000-0000-0000-0000-000000018a01',
  '[{"product_id": "40000000-0000-0000-0000-000000018a01", "qty": 8}]'::jsonb,
  '50000000-0000-0000-0000-000000018a01', 'cash', '30000000-0000-0000-0000-000000018a01', 'boleta', null,
  '[{"product_id": "40000000-0000-0000-0000-000000018a01", "warehouse_id": "30000000-0000-0000-0000-000000018a01", "qty": 5},
    {"product_id": "40000000-0000-0000-0000-000000018a01", "warehouse_id": "30000000-0000-0000-0000-000000018a02", "qty": 3}]'::jsonb));
select results_eq(
  $$select pg_temp.stock('30000000-0000-0000-0000-000000018a01'), pg_temp.stock('30000000-0000-0000-0000-000000018a02')$$,
  $$values (0, 7)$$,
  'cobrar y entregar reparte 5 + 3');
select is((select status from public.sales where id = (select sale_id from s1810 where label = 'mostrador')),
  'delivered', 'queda entregada');

-- === La devolución también reintegra por bodega ===
select public.refund_sale('10000000-0000-0000-0000-000000018a01',
  (select receipt_number from public.sales where id = (select sale_id from s1810 where label = 'mostrador')),
  'Prueba');
select results_eq(
  $$select pg_temp.stock('30000000-0000-0000-0000-000000018a01'), pg_temp.stock('30000000-0000-0000-0000-000000018a02')$$,
  $$values (5, 10)$$,
  'la devolución reintegra 5 a Cinecultivo y 3 a Kreadu');

-- === confirm_sale (una sola bodega) sigue igual ===
insert into s1810 values ('simple', public.create_sale('10000000-0000-0000-0000-000000018a01',
  '[{"product_id": "40000000-0000-0000-0000-000000018a01", "qty": 2}]'::jsonb,
  '50000000-0000-0000-0000-000000018a01'));
select lives_ok(
  $$select public.confirm_sale((select sale_id from s1810 where label = 'simple'), '30000000-0000-0000-0000-000000018a03')$$,
  'confirm_sale de una bodega sigue funcionando (aunque no preste stock)');

-- === Tenant ajeno ===
insert into s1810 values ('ajena', public.create_sale('10000000-0000-0000-0000-000000018a01',
  '[{"product_id": "40000000-0000-0000-0000-000000018a01", "qty": 1}]'::jsonb,
  '50000000-0000-0000-0000-000000018a01'));
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000018a02", "role": "authenticated"}';
select throws_ok(
  $$select public.confirm_sale_allocated((select sale_id from s1810 where label = 'ajena'),
    '30000000-0000-0000-0000-000000018a01',
    '[{"product_id": "40000000-0000-0000-0000-000000018a01", "warehouse_id": "30000000-0000-0000-0000-000000018a01", "qty": 1}]'::jsonb)$$,
  'P0001', 'permission_denied', 'otra empresa no confirma ventas de esta');

select * from finish();
rollback;
