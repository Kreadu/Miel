-- S3-02 — Órdenes de compra: tablas purchases/purchase_items (solo select por RLS, escritura
-- únicamente vía RPC) + create_purchase (atómica, totales en BD) + mark_purchase_ordered.
-- Ver specs/done/S3-02-ordenes-compra.md, docs/arch/patron-rpc.md, docs/arch/multitenancy-rls.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- Fixtures: tenant A (owner + member) y tenant B (owner), cada uno con proveedor y productos.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000eee1', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000eee2', 'member-a@test.local'),
  ('00000000-0000-0000-0000-00000000fff1', 'owner-b@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-00000000eee1', 'Tenant A'),
  ('10000000-0000-0000-0000-00000000fff1', 'Tenant B');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-00000000eee1', '10000000-0000-0000-0000-00000000eee1', 'owner',
   '00000000-0000-0000-0000-00000000eee1'),
  ('00000000-0000-0000-0000-00000000eee2', '10000000-0000-0000-0000-00000000eee1', 'member',
   '00000000-0000-0000-0000-00000000eee1'),
  ('00000000-0000-0000-0000-00000000fff1', '10000000-0000-0000-0000-00000000fff1', 'owner',
   '00000000-0000-0000-0000-00000000fff1');

insert into public.suppliers (id, tenant_id, name, created_by) values
  ('20000000-0000-0000-0000-00000000eee1', '10000000-0000-0000-0000-00000000eee1',
   'Proveedor A', '00000000-0000-0000-0000-00000000eee1'),
  ('20000000-0000-0000-0000-00000000eee2', '10000000-0000-0000-0000-00000000eee1',
   'Proveedor Inactivo', '00000000-0000-0000-0000-00000000eee1'),
  ('20000000-0000-0000-0000-00000000fff1', '10000000-0000-0000-0000-00000000fff1',
   'Proveedor B', '00000000-0000-0000-0000-00000000fff1');

update public.suppliers set active = false
  where id = '20000000-0000-0000-0000-00000000eee2';

insert into public.products (id, tenant_id, sku, name, cost, price, created_by) values
  ('30000000-0000-0000-0000-00000000eee1', '10000000-0000-0000-0000-00000000eee1',
   'SKU-A1', 'Producto A1', 100, 200, '00000000-0000-0000-0000-00000000eee1'),
  ('30000000-0000-0000-0000-00000000eee2', '10000000-0000-0000-0000-00000000eee1',
   'SKU-A2', 'Producto A2', 50, 90, '00000000-0000-0000-0000-00000000eee1'),
  ('30000000-0000-0000-0000-00000000fff1', '10000000-0000-0000-0000-00000000fff1',
   'SKU-B1', 'Producto B1', 100, 200, '00000000-0000-0000-0000-00000000fff1');

-- === Simular al owner del tenant A ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000eee1", "role": "authenticated"}';

-- === C-RLS: escritura directa bloqueada (sin política de insert/update) ===
select throws_ok(
  $$insert into public.purchases (tenant_id, supplier_id, created_by)
    values ('10000000-0000-0000-0000-00000000eee1', '20000000-0000-0000-0000-00000000eee1',
            '00000000-0000-0000-0000-00000000eee1')$$,
  '42501', null, 'C-RLS: insert directo en purchases rechazado (sin política de write)');

-- === C1: create_purchase con 2 ítems calcula subtotal/tax/total en BD ===
select lives_ok(
  $$select public.create_purchase(
      '20000000-0000-0000-0000-00000000eee1',
      'draft',
      '[
        {"product_id": "30000000-0000-0000-0000-00000000eee1", "qty": 2, "unit_cost": 100, "tax_rate": 19},
        {"product_id": "30000000-0000-0000-0000-00000000eee2", "qty": 3, "unit_cost": 50, "tax_rate": 0}
      ]'::jsonb
  )$$,
  'C1: create_purchase con 2 ítems no falla');

-- subtotal = 2*100 + 3*50 = 350; tax = 2*100*0.19 + 3*50*0 = 38; total = 388
select is(
  (select subtotal from public.purchases where supplier_id = '20000000-0000-0000-0000-00000000eee1'),
  350.00::numeric, 'C1: subtotal calculado en BD es exacto');
select is(
  (select tax from public.purchases where supplier_id = '20000000-0000-0000-0000-00000000eee1'),
  38.00::numeric, 'C1: tax calculado en BD es exacto');
select is(
  (select total from public.purchases where supplier_id = '20000000-0000-0000-0000-00000000eee1'),
  388.00::numeric, 'C1: total calculado en BD es exacto');
select is(
  (select count(*)::int from public.purchase_items pi
   join public.purchases p on p.id = pi.purchase_id
   where p.supplier_id = '20000000-0000-0000-0000-00000000eee1'),
  2, 'C1: los 2 ítems quedaron registrados');

-- === C2: crear draft deja issued_at NULL; crear ordered lo fija ===
select is(
  (select issued_at from public.purchases where supplier_id = '20000000-0000-0000-0000-00000000eee1'),
  null, 'C2: orden creada como draft tiene issued_at NULL');

select lives_ok(
  $$select public.create_purchase(
      '20000000-0000-0000-0000-00000000eee1',
      'ordered',
      '[{"product_id": "30000000-0000-0000-0000-00000000eee1", "qty": 1, "unit_cost": 100, "tax_rate": 0}]'::jsonb
  )$$,
  'C2: create_purchase como ordered no falla');

select isnt(
  (select issued_at from public.purchases where status = 'ordered'
   and supplier_id = '20000000-0000-0000-0000-00000000eee1'),
  null, 'C2: orden creada como ordered tiene issued_at fijado');

-- === C2: mark_purchase_ordered transiciona draft -> ordered ===
select lives_ok(
  format(
    $$select public.mark_purchase_ordered('%s'::uuid)$$,
    (select id from public.purchases
     where status = 'draft' and supplier_id = '20000000-0000-0000-0000-00000000eee1')
  ),
  'C2: mark_purchase_ordered no falla sobre una draft');

select is(
  (select count(*)::int from public.purchases
   where supplier_id = '20000000-0000-0000-0000-00000000eee1' and status = 'draft'),
  0, 'C2: ya no queda ninguna draft para ese proveedor tras marcarla');

-- === C4: rechazos — sin ítems, qty<=0, proveedor inactivo, producto ajeno ===
select throws_ok(
  $$select public.create_purchase(
      '20000000-0000-0000-0000-00000000eee1', 'draft', '[]'::jsonb
  )$$,
  'P0001', null, 'C4: orden sin ítems es rechazada');

select throws_ok(
  $$select public.create_purchase(
      '20000000-0000-0000-0000-00000000eee1', 'draft',
      '[{"product_id": "30000000-0000-0000-0000-00000000eee1", "qty": -1, "unit_cost": 100}]'::jsonb
  )$$,
  'P0001', null, 'C4: ítem con qty<=0 es rechazado');

select throws_ok(
  $$select public.create_purchase(
      '20000000-0000-0000-0000-00000000eee2', 'draft',
      '[{"product_id": "30000000-0000-0000-0000-00000000eee1", "qty": 1, "unit_cost": 100}]'::jsonb
  )$$,
  'P0001', null, 'C4: proveedor inactivo es rechazado');

select throws_ok(
  $$select public.create_purchase(
      '20000000-0000-0000-0000-00000000eee1', 'draft',
      '[{"product_id": "30000000-0000-0000-0000-00000000fff1", "qty": 1, "unit_cost": 100}]'::jsonb
  )$$,
  'P0001', null, 'C4: producto de otro tenant es rechazado');

-- === C5: aislamiento — A no ve órdenes de B ===
select is(
  (select count(*)::int from public.purchases where tenant_id = '10000000-0000-0000-0000-00000000fff1'),
  0, 'C5: A no ve órdenes del tenant B');

-- === C3: member no puede invocar la RPC (rechazo por rol, no por RLS de tabla) ===
reset role;
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000eee2", "role": "authenticated"}';

select throws_ok(
  $$select public.create_purchase(
      '20000000-0000-0000-0000-00000000eee1', 'draft',
      '[{"product_id": "30000000-0000-0000-0000-00000000eee1", "qty": 1, "unit_cost": 100}]'::jsonb
  )$$,
  'P0001', null, 'C3: member no puede crear una orden (rol no admin)');

-- === C3: member sí ve el listado de su tenant (select amplio) ===
select ok(
  (select count(*)::int from public.purchases
   where tenant_id = '10000000-0000-0000-0000-00000000eee1') > 0,
  'C3: member ve el listado de órdenes de su tenant');

select * from finish();
rollback;
