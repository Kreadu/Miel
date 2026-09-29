-- S19-35 — Tarifas de envío (RLS) y costo de envío calculado en create_sale.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000035a01', 'owner-a-s1935@test.local'),
  ('00000000-0000-0000-0000-000000035a02', 'member-a-s1935@test.local'),
  ('00000000-0000-0000-0000-000000035b01', 'owner-b-s1935@test.local');
insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-000000035a01', 'Tenant A S19-35'),
  ('10000000-0000-0000-0000-000000035b01', 'Tenant B S19-35');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000035a01', '10000000-0000-0000-0000-000000035a01', 'owner',
   '00000000-0000-0000-0000-000000035a01'),
  ('00000000-0000-0000-0000-000000035a02', '10000000-0000-0000-0000-000000035a01', 'member',
   '00000000-0000-0000-0000-000000035a01'),
  ('00000000-0000-0000-0000-000000035b01', '10000000-0000-0000-0000-000000035b01', 'owner',
   '00000000-0000-0000-0000-000000035b01');
insert into public.products (id, tenant_id, sku, name, kind, price, tax_rate, weight_kg, created_by) values
  ('40000000-0000-0000-0000-000000035a01', '10000000-0000-0000-0000-000000035a01', 'S1935', 'Miel',
   'resale', 10000, 0, 2, '00000000-0000-0000-0000-000000035a01');
insert into public.shipping_rates (id, tenant_id, name, base_price, price_per_kg, price_per_km, created_by) values
  ('50000000-0000-0000-0000-000000035a01', '10000000-0000-0000-0000-000000035a01', 'Moto', 5000, 1000, 200,
   '00000000-0000-0000-0000-000000035a01'),
  ('50000000-0000-0000-0000-000000035b01', '10000000-0000-0000-0000-000000035b01', 'Ajena', 1, 1, 1,
   '00000000-0000-0000-0000-000000035b01');

create temp table s1935 (label text, sale_id uuid) on commit drop;
grant all on s1935 to authenticated;

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000035a01", "role": "authenticated"}';

-- === C1: aislamiento de tarifas ===
select is((select count(*)::int from public.shipping_rates), 1, 'C1: A ve solo su tarifa');

-- === C2: transporte = base + kg·peso + km·distancia (3 × 2 kg = 6 kg, 10 km) ===
insert into s1935 values ('carrier', public.create_sale(
  '10000000-0000-0000-0000-000000035a01',
  '[{"product_id": "40000000-0000-0000-0000-000000035a01", "qty": 3, "unit_price": 10000}]'::jsonb,
  null, null, null, 'carrier', '50000000-0000-0000-0000-000000035a01', 10, 999999));
select is(
  (select shipping_cost from public.sales where id = (select sale_id from s1935 where label = 'carrier')),
  13000.00::numeric, 'C2: 5000 + 1000·6 + 200·10, ignora el costo que manda la pantalla');
select is(
  (select total from public.sales where id = (select sale_id from s1935 where label = 'carrier')),
  43000.00::numeric, 'C2: total = 30000 + 0 IVA + 13000 de envío');

-- === C3: acordado usa el monto a mano; retiro en tienda es 0 ===
insert into s1935 values ('agreed', public.create_sale(
  '10000000-0000-0000-0000-000000035a01',
  '[{"product_id": "40000000-0000-0000-0000-000000035a01", "qty": 1, "unit_price": 10000}]'::jsonb,
  null, null, null, 'agreed', null, null, 7000));
select is(
  (select shipping_cost from public.sales where id = (select sale_id from s1935 where label = 'agreed')),
  7000.00::numeric, 'C3: envío acordado');
insert into s1935 values ('pickup', public.create_sale(
  '10000000-0000-0000-0000-000000035a01',
  '[{"product_id": "40000000-0000-0000-0000-000000035a01", "qty": 1, "unit_price": 10000}]'::jsonb,
  null, null, null, 'pickup'));
select is(
  (select total from public.sales where id = (select sale_id from s1935 where label = 'pickup')),
  10000.00::numeric, 'C3: retiro en tienda sin costo');

-- === C4: tarifa de otra empresa o km faltantes se rechazan ===
select throws_ok(
  $$select public.create_sale('10000000-0000-0000-0000-000000035a01',
    '[{"product_id": "40000000-0000-0000-0000-000000035a01", "qty": 1, "unit_price": 10000}]'::jsonb,
    null, null, null, 'carrier', '50000000-0000-0000-0000-000000035b01', 5)$$,
  'P0001', 'shipping_rate_invalid', 'C4: tarifa ajena');
select throws_ok(
  $$select public.create_sale('10000000-0000-0000-0000-000000035a01',
    '[{"product_id": "40000000-0000-0000-0000-000000035a01", "qty": 1, "unit_price": 10000}]'::jsonb,
    null, null, null, 'carrier', '50000000-0000-0000-0000-000000035a01', null)$$,
  'P0001', 'shipping_km_invalid', 'C4: sin km');

-- === C5: member no crea tarifas ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000035a02", "role": "authenticated"}';
select throws_ok(
  $$insert into public.shipping_rates (tenant_id, name) values ('10000000-0000-0000-0000-000000035a01', 'X')$$,
  '42501', null, 'C5: member no crea tarifas');

-- === C6: B no ve las tarifas de A ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000035b01", "role": "authenticated"}';
select is(
  (select count(*)::int from public.shipping_rates where tenant_id = '10000000-0000-0000-0000-000000035a01'),
  0, 'C6: aislamiento');

select * from finish();
rollback;
