-- S5-02 — Ventas en borrador: tablas sales/sale_items (solo select por RLS, escritura
-- únicamente vía RPC) + create_sale (atómica, totales en BD, cliente opcional, cualquier rol).
-- Ver specs/done/S5-02-ventas-borrador.md, docs/arch/patron-rpc.md, docs/arch/multitenancy-rls.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- Fixtures: tenant A (owner + member) y tenant B (owner), cada uno con cliente y productos.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000aaa1', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000aaa2', 'member-a@test.local'),
  ('00000000-0000-0000-0000-00000000bbb1', 'owner-b@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-00000000aaa1', 'Tenant A'),
  ('10000000-0000-0000-0000-00000000bbb1', 'Tenant B');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-00000000aaa1', '10000000-0000-0000-0000-00000000aaa1', 'owner',
   '00000000-0000-0000-0000-00000000aaa1'),
  ('00000000-0000-0000-0000-00000000aaa2', '10000000-0000-0000-0000-00000000aaa1', 'member',
   '00000000-0000-0000-0000-00000000aaa1'),
  ('00000000-0000-0000-0000-00000000bbb1', '10000000-0000-0000-0000-00000000bbb1', 'owner',
   '00000000-0000-0000-0000-00000000bbb1');

insert into public.customers (id, tenant_id, name, created_by) values
  ('40000000-0000-0000-0000-00000000aaa1', '10000000-0000-0000-0000-00000000aaa1',
   'Cliente A', '00000000-0000-0000-0000-00000000aaa1'),
  ('40000000-0000-0000-0000-00000000aaa2', '10000000-0000-0000-0000-00000000aaa1',
   'Cliente Inactivo', '00000000-0000-0000-0000-00000000aaa1'),
  ('40000000-0000-0000-0000-00000000bbb1', '10000000-0000-0000-0000-00000000bbb1',
   'Cliente B', '00000000-0000-0000-0000-00000000bbb1');

update public.customers set active = false
  where id = '40000000-0000-0000-0000-00000000aaa2';

insert into public.products (id, tenant_id, sku, name, cost, price, created_by) values
  ('30000000-0000-0000-0000-00000000aaa1', '10000000-0000-0000-0000-00000000aaa1',
   'SKU-A1', 'Producto A1', 100, 200, '00000000-0000-0000-0000-00000000aaa1'),
  ('30000000-0000-0000-0000-00000000aaa2', '10000000-0000-0000-0000-00000000aaa1',
   'SKU-A2', 'Producto A2', 50, 90, '00000000-0000-0000-0000-00000000aaa1'),
  ('30000000-0000-0000-0000-00000000bbb1', '10000000-0000-0000-0000-00000000bbb1',
   'SKU-B1', 'Producto B1', 100, 200, '00000000-0000-0000-0000-00000000bbb1');

-- === Simular al owner del tenant A ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000aaa1", "role": "authenticated"}';

-- === C-RLS: escritura directa bloqueada (sin política de insert/update) ===
select throws_ok(
  $$insert into public.sales (tenant_id, customer_id, created_by)
    values ('10000000-0000-0000-0000-00000000aaa1', '40000000-0000-0000-0000-00000000aaa1',
            '00000000-0000-0000-0000-00000000aaa1')$$,
  '42501', null, 'C-RLS: insert directo en sales rechazado (sin política de write)');

-- === C1: create_sale con 2 ítems calcula subtotal/tax/total en BD ===
select lives_ok(
  $$select public.create_sale(
      '10000000-0000-0000-0000-00000000aaa1',
      '[
        {"product_id": "30000000-0000-0000-0000-00000000aaa1", "qty": 2, "unit_price": 200, "tax_rate": 19},
        {"product_id": "30000000-0000-0000-0000-00000000aaa2", "qty": 3, "unit_price": 90, "tax_rate": 0}
      ]'::jsonb,
      '40000000-0000-0000-0000-00000000aaa1'
  )$$,
  'C1: create_sale con 2 ítems no falla');

-- subtotal = 2*200 + 3*90 = 670; tax = 2*200*0.19 + 3*90*0 = 76; total = 746
select is(
  (select subtotal from public.sales where customer_id = '40000000-0000-0000-0000-00000000aaa1'),
  670.00::numeric, 'C1: subtotal calculado en BD es exacto');
select is(
  (select tax from public.sales where customer_id = '40000000-0000-0000-0000-00000000aaa1'),
  76.00::numeric, 'C1: tax calculado en BD es exacto');
select is(
  (select total from public.sales where customer_id = '40000000-0000-0000-0000-00000000aaa1'),
  746.00::numeric, 'C1: total calculado en BD es exacto');
select is(
  (select status from public.sales where customer_id = '40000000-0000-0000-0000-00000000aaa1'),
  'draft', 'C1: la venta nace en status draft');
select is(
  (select count(*)::int from public.sale_items si
   join public.sales s on s.id = si.sale_id
   where s.customer_id = '40000000-0000-0000-0000-00000000aaa1'),
  2, 'C1: los 2 ítems quedaron registrados');

-- === C2: venta de mostrador (customer_id null) es válida ===
select lives_ok(
  $$select public.create_sale(
      '10000000-0000-0000-0000-00000000aaa1',
      '[{"product_id": "30000000-0000-0000-0000-00000000aaa1", "qty": 1, "unit_price": 200}]'::jsonb
  )$$,
  'C2: create_sale sin customer_id (mostrador) no falla');

select is(
  (select count(*)::int from public.sales
   where tenant_id = '10000000-0000-0000-0000-00000000aaa1' and customer_id is null),
  1, 'C2: la venta de mostrador queda registrada con customer_id null');

-- === C4: rechazos — sin ítems, qty<=0, unit_price<0, cliente inactivo, producto ajeno ===
select throws_ok(
  $$select public.create_sale(
      '10000000-0000-0000-0000-00000000aaa1', '[]'::jsonb
  )$$,
  'P0001', null, 'C4: venta sin ítems es rechazada');

select throws_ok(
  $$select public.create_sale(
      '10000000-0000-0000-0000-00000000aaa1',
      '[{"product_id": "30000000-0000-0000-0000-00000000aaa1", "qty": -1, "unit_price": 200}]'::jsonb
  )$$,
  'P0001', null, 'C4: ítem con qty<=0 es rechazado');

select throws_ok(
  $$select public.create_sale(
      '10000000-0000-0000-0000-00000000aaa1',
      '[{"product_id": "30000000-0000-0000-0000-00000000aaa1", "qty": 1, "unit_price": -1}]'::jsonb
  )$$,
  'P0001', null, 'C4: ítem con unit_price<0 es rechazado');

select throws_ok(
  $$select public.create_sale(
      '10000000-0000-0000-0000-00000000aaa1',
      '[{"product_id": "30000000-0000-0000-0000-00000000aaa1", "qty": 1, "unit_price": 200}]'::jsonb,
      '40000000-0000-0000-0000-00000000aaa2'
  )$$,
  'P0001', null, 'C4: cliente inactivo es rechazado');

select throws_ok(
  $$select public.create_sale(
      '10000000-0000-0000-0000-00000000aaa1',
      '[{"product_id": "30000000-0000-0000-0000-00000000bbb1", "qty": 1, "unit_price": 200}]'::jsonb
  )$$,
  'P0001', null, 'C4: producto de otro tenant es rechazado');

-- === C5: aislamiento — A no ve ventas de B ===
select is(
  (select count(*)::int from public.sales where tenant_id = '10000000-0000-0000-0000-00000000bbb1'),
  0, 'C5: A no ve ventas del tenant B');

select throws_ok(
  $$select public.create_sale(
      '10000000-0000-0000-0000-00000000bbb1',
      '[{"product_id": "30000000-0000-0000-0000-00000000bbb1", "qty": 1, "unit_price": 200}]'::jsonb
  )$$,
  'P0001', null, 'C5: A no puede crear una venta en el tenant B (no pertenece)');

-- === C3: member SÍ puede invocar create_sale (a diferencia de compras, no requiere admin) ===
reset role;
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000aaa2", "role": "authenticated"}';

select lives_ok(
  $$select public.create_sale(
      '10000000-0000-0000-0000-00000000aaa1',
      '[{"product_id": "30000000-0000-0000-0000-00000000aaa1", "qty": 1, "unit_price": 200}]'::jsonb
  )$$,
  'C3: member SÍ puede crear una venta (no requiere rol admin)');

-- === C3: member ve el listado de su tenant (select amplio) ===
select ok(
  (select count(*)::int from public.sales
   where tenant_id = '10000000-0000-0000-0000-00000000aaa1') > 0,
  'C3: member ve el listado de ventas de su tenant');

select * from finish();
rollback;
