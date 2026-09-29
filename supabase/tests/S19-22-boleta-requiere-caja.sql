-- S19-22 — La boleta (confirm_sale) de productos que se venden en tienda exige caja abierta
-- de quien confirma. El pedido (create_sale) no la exige.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000022a01', 'owner-s1922@test.local'),
  ('00000000-0000-0000-0000-000000022a02', 'cajero-s1922@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-000000022a01', 'Tenant S19-22');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000022a01', '10000000-0000-0000-0000-000000022a01', 'owner',
   '00000000-0000-0000-0000-000000022a01'),
  ('00000000-0000-0000-0000-000000022a02', '10000000-0000-0000-0000-000000022a01', 'member',
   '00000000-0000-0000-0000-000000022a01');

insert into public.warehouses (id, tenant_id, name, created_by) values
  ('30000000-0000-0000-0000-000000022a01', '10000000-0000-0000-0000-000000022a01', 'Bodega',
   '00000000-0000-0000-0000-000000022a01');

insert into public.products (id, tenant_id, sku, name, cost, price, sales_channel, created_by) values
  ('40000000-0000-0000-0000-000000022a01', '10000000-0000-0000-0000-000000022a01', 'S1922-T',
   'Tienda', 10, 20, 'in_store', '00000000-0000-0000-0000-000000022a01'),
  ('40000000-0000-0000-0000-000000022a02', '10000000-0000-0000-0000-000000022a01', 'S1922-A',
   'Ambas', 10, 20, 'both', '00000000-0000-0000-0000-000000022a01'),
  ('40000000-0000-0000-0000-000000022a03', '10000000-0000-0000-0000-000000022a01', 'S1922-O',
   'Online', 10, 20, 'online', '00000000-0000-0000-0000-000000022a01');

insert into public.stock_movements (tenant_id, product_id, warehouse_id, kind, qty, unit_cost, created_by)
select '10000000-0000-0000-0000-000000022a01', p, '30000000-0000-0000-0000-000000022a01', 'in', 50, 10,
       '00000000-0000-0000-0000-000000022a01'
from unnest(array['40000000-0000-0000-0000-000000022a01', '40000000-0000-0000-0000-000000022a02',
                  '40000000-0000-0000-0000-000000022a03']::uuid[]) p;

create temp table s1922 (label text, sale_id uuid) on commit drop;
grant all on s1922 to authenticated;

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000022a02", "role": "authenticated"}';

-- === C1: el pedido se crea sin caja abierta ===
insert into s1922 values
  ('tienda', public.create_sale('10000000-0000-0000-0000-000000022a01',
    '[{"product_id": "40000000-0000-0000-0000-000000022a01", "qty": 1, "unit_price": 20}]'::jsonb)),
  ('ambas', public.create_sale('10000000-0000-0000-0000-000000022a01',
    '[{"product_id": "40000000-0000-0000-0000-000000022a02", "qty": 1, "unit_price": 20}]'::jsonb)),
  ('online', public.create_sale('10000000-0000-0000-0000-000000022a01',
    '[{"product_id": "40000000-0000-0000-0000-000000022a03", "qty": 1, "unit_price": 20}]'::jsonb));

select is((select count(*)::int from s1922 where sale_id is not null), 3,
  'C1: los pedidos se crean con la caja cerrada');

-- === C2: sin caja, no hay boleta para productos de tienda ("Solo tienda" y "Ambas") ===
select throws_ok(
  $$select public.confirm_sale((select sale_id from s1922 where label = 'tienda'),
    '30000000-0000-0000-0000-000000022a01'::uuid)$$,
  'P0001', 'cash_session_required', 'C2: "Solo tienda" exige caja abierta');

select throws_ok(
  $$select public.confirm_sale((select sale_id from s1922 where label = 'ambas'),
    '30000000-0000-0000-0000-000000022a01'::uuid)$$,
  'P0001', 'cash_session_required', 'C2: "Ambas" exige caja abierta');

select is(
  (select status from public.sales where id = (select sale_id from s1922 where label = 'tienda')),
  'draft', 'C2: el pedido sigue en borrador, sin boleta');

-- === C3: productos solo online no exigen caja ===
select lives_ok(
  $$select public.confirm_sale((select sale_id from s1922 where label = 'online'),
    '30000000-0000-0000-0000-000000022a01'::uuid)$$,
  'C3: pedido solo online genera boleta sin caja');

-- === C4: la caja de OTRO usuario no alcanza ===
reset role;
insert into public.cash_sessions (tenant_id, opened_by, opening_amount, created_by) values
  ('10000000-0000-0000-0000-000000022a01', '00000000-0000-0000-0000-000000022a01', 0,
   '00000000-0000-0000-0000-000000022a01');
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000022a02", "role": "authenticated"}';

select throws_ok(
  $$select public.confirm_sale((select sale_id from s1922 where label = 'tienda'),
    '30000000-0000-0000-0000-000000022a01'::uuid)$$,
  'P0001', 'cash_session_required', 'C4: la caja abierta de otro usuario no habilita la boleta');

-- === C5: con su caja abierta, genera la boleta y la venta queda ligada a la caja ===
select public.open_cash_session(0, '10000000-0000-0000-0000-000000022a01');

select lives_ok(
  $$select public.confirm_sale((select sale_id from s1922 where label = 'tienda'),
    '30000000-0000-0000-0000-000000022a01'::uuid)$$,
  'C5: con caja abierta genera la boleta');

select is(
  (select cash_session_id from public.sales where id = (select sale_id from s1922 where label = 'tienda')),
  (select id from public.cash_sessions
   where opened_by = '00000000-0000-0000-0000-000000022a02' and status = 'open'),
  'C5: la venta queda ligada a la caja de quien confirmó');

select * from finish();
rollback;
