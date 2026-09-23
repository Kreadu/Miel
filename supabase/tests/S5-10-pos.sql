-- S5-10 — Pantalla POS de venta rápida: register_pos_sale (venta de mostrador en un paso,
-- ligada a la caja, pagos mixtos, atomicidad). Ver specs/S5-10-pos-venta-rapida.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Fixtures: tenant A (owner + 2 members) y tenant B (owner).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000010a1', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-0000000010a2', 'member-a@test.local'),
  ('00000000-0000-0000-0000-0000000010a3', 'member2-a@test.local'),
  ('00000000-0000-0000-0000-0000000010b1', 'owner-b@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-0000000010a0', 'Tenant A'),
  ('10000000-0000-0000-0000-0000000010b0', 'Tenant B');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-0000000010a1', '10000000-0000-0000-0000-0000000010a0', 'owner',
   '00000000-0000-0000-0000-0000000010a1'),
  ('00000000-0000-0000-0000-0000000010a2', '10000000-0000-0000-0000-0000000010a0', 'member',
   '00000000-0000-0000-0000-0000000010a1'),
  ('00000000-0000-0000-0000-0000000010a3', '10000000-0000-0000-0000-0000000010a0', 'member',
   '00000000-0000-0000-0000-0000000010a1'),
  ('00000000-0000-0000-0000-0000000010b1', '10000000-0000-0000-0000-0000000010b0', 'owner',
   '00000000-0000-0000-0000-0000000010b1');

insert into public.warehouses (id, tenant_id, name, created_by) values
  ('30000000-0000-0000-0000-0000000010a0', '10000000-0000-0000-0000-0000000010a0', 'Bodega A',
   '00000000-0000-0000-0000-0000000010a1'),
  ('30000000-0000-0000-0000-0000000010b0', '10000000-0000-0000-0000-0000000010b0', 'Bodega B',
   '00000000-0000-0000-0000-0000000010b1');

insert into public.products (id, tenant_id, sku, name, cost, price, created_by) values
  ('40000000-0000-0000-0000-0000000010a0', '10000000-0000-0000-0000-0000000010a0', 'SKU-A1',
   'Producto A1', 60, 100, '00000000-0000-0000-0000-0000000010a1');

-- Stock inicial holgado para las ventas felices; la venta de C4 pedirá más de lo disponible.
insert into public.stock_movements (tenant_id, product_id, warehouse_id, kind, qty, unit_cost, created_by) values
  ('10000000-0000-0000-0000-0000000010a0', '40000000-0000-0000-0000-0000000010a0',
   '30000000-0000-0000-0000-0000000010a0', 'in', 100, 60, '00000000-0000-0000-0000-0000000010a1');

-- === member_a abre su caja y hace ventas POS ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-0000000010a2", "role": "authenticated"}';

select public.open_cash_session(500, '10000000-0000-0000-0000-0000000010a0');

-- === C1: venta POS de mostrador (sin cliente), pago en efectivo = total ===
create temporary table c1 as
select public.register_pos_sale(
  '10000000-0000-0000-0000-0000000010a0'::uuid,
  '30000000-0000-0000-0000-0000000010a0'::uuid,
  '[{"product_id":"40000000-0000-0000-0000-0000000010a0","qty":2,"unit_price":100,"tax_rate":0,"discount":0}]'::jsonb,
  '[{"method":"cash","amount":200}]'::jsonb,
  null, null
) as sale_id;

select isnt((select sale_id from c1), null, 'C1: register_pos_sale crea la venta y retorna id');

select is(
  (select status from public.sales where id = (select sale_id from c1)),
  'confirmed', 'C1: la venta queda confirmed');

select is(
  (select receipt_number from public.sales where id = (select sale_id from c1)),
  1, 'C1: primer recibo del tenant = 1');

select is(
  (select sum(qty) from public.stock_movements
   where ref_type = 'sale' and ref_id = (select sale_id::text from c1)),
  -2.000::numeric, 'C1: salida de stock por el ítem (qty -2)');

select is(
  (select cash_session_id from public.sales where id = (select sale_id from c1)),
  (select id from public.cash_sessions where opened_by = '00000000-0000-0000-0000-0000000010a2'),
  'C1: la venta queda ligada a la sesión de caja abierta');

select is(
  (select count(*)::int from public.customer_payments
   where sale_id = (select sale_id from c1)
     and method = 'cash' and customer_id is null
     and cash_session_id = (select id from public.cash_sessions where opened_by = '00000000-0000-0000-0000-0000000010a2')),
  1, 'C1: cobro de mostrador (customer_id null) ligado a la sesión');

-- === C2: usuario sin caja abierta (owner_a) no puede vender por POS ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-0000000010a1", "role": "authenticated"}';

select throws_ok(
  $$select public.register_pos_sale(
      '10000000-0000-0000-0000-0000000010a0'::uuid,
      '30000000-0000-0000-0000-0000000010a0'::uuid,
      '[{"product_id":"40000000-0000-0000-0000-0000000010a0","qty":1,"unit_price":100,"tax_rate":0,"discount":0}]'::jsonb,
      '[{"method":"cash","amount":100}]'::jsonb,
      null, null
  )$$,
  'P0001', 'pos_no_open_session', 'C2: sin caja abierta la venta POS falla');

-- === C3: Σ pagos ≠ total → pos_payment_mismatch, atomicidad ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-0000000010a2", "role": "authenticated"}';

select throws_ok(
  $$select public.register_pos_sale(
      '10000000-0000-0000-0000-0000000010a0'::uuid,
      '30000000-0000-0000-0000-0000000010a0'::uuid,
      '[{"product_id":"40000000-0000-0000-0000-0000000010a0","qty":1,"unit_price":150,"tax_rate":0,"discount":0}]'::jsonb,
      '[{"method":"cash","amount":100}]'::jsonb,
      null, null
  )$$,
  'P0001', 'pos_payment_mismatch', 'C3: pago que no cubre el total falla');

select is(
  (select count(*)::int from public.sales
   where tenant_id = '10000000-0000-0000-0000-0000000010a0' and total = 150),
  0, 'C3: atomicidad — no queda venta a medias del intento fallido');

-- === C4: stock insuficiente → rollback, sin consumir número de recibo ===
select throws_ok(
  $$select public.register_pos_sale(
      '10000000-0000-0000-0000-0000000010a0'::uuid,
      '30000000-0000-0000-0000-0000000010a0'::uuid,
      '[{"product_id":"40000000-0000-0000-0000-0000000010a0","qty":999,"unit_price":100,"tax_rate":0,"discount":0}]'::jsonb,
      '[{"method":"cash","amount":99900}]'::jsonb,
      null, null
  )$$,
  'P0001', 'stock_insufficient', 'C4: venta que excede el stock falla');

-- La siguiente venta feliz debe tomar el recibo 2 (el intento fallido no consumió número).
create temporary table c4 as
select public.register_pos_sale(
  '10000000-0000-0000-0000-0000000010a0'::uuid,
  '30000000-0000-0000-0000-0000000010a0'::uuid,
  '[{"product_id":"40000000-0000-0000-0000-0000000010a0","qty":2,"unit_price":100,"tax_rate":0,"discount":0}]'::jsonb,
  '[{"method":"cash","amount":200}]'::jsonb,
  null, null
) as sale_id;

select is(
  (select receipt_number from public.sales where id = (select sale_id from c4)),
  2, 'C4: recibo consecutivo sin huecos (2, no 3) tras el fallo');

-- === C5: pagos mixtos (efectivo + tarjeta) que suman el total; solo cash cuenta en el arqueo ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-0000000010a3", "role": "authenticated"}';

select public.open_cash_session(100, '10000000-0000-0000-0000-0000000010a0');

create temporary table c5 as
select public.register_pos_sale(
  '10000000-0000-0000-0000-0000000010a0'::uuid,
  '30000000-0000-0000-0000-0000000010a0'::uuid,
  '[{"product_id":"40000000-0000-0000-0000-0000000010a0","qty":3,"unit_price":100,"tax_rate":0,"discount":0}]'::jsonb,
  '[{"method":"cash","amount":200},{"method":"card","amount":100}]'::jsonb,
  null, null
) as sale_id;

select is(
  (select total from public.sales where id = (select sale_id from c5)),
  300.00::numeric, 'C5: venta con pagos mixtos que suman el total (300)');

select public.close_cash_session(999);

select is(
  (select expected_amount from public.cash_sessions where opened_by = '00000000-0000-0000-0000-0000000010a3'),
  300.00::numeric, 'C5: esperado del arqueo = base (100) + solo efectivo (200), la tarjeta no cuenta');

-- === Aislamiento: owner_b no puede vender contra el tenant A ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-0000000010b1", "role": "authenticated"}';

select throws_ok(
  $$select public.register_pos_sale(
      '10000000-0000-0000-0000-0000000010a0'::uuid,
      '30000000-0000-0000-0000-0000000010a0'::uuid,
      '[{"product_id":"40000000-0000-0000-0000-0000000010a0","qty":1,"unit_price":100,"tax_rate":0,"discount":0}]'::jsonb,
      '[{"method":"cash","amount":100}]'::jsonb,
      null, null
  )$$,
  'P0001', 'permission_denied', 'ISO: usuario de otro tenant no vende contra el tenant A');

select * from finish();
rollback;
