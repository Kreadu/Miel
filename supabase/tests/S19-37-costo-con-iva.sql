-- S19-37 — receive_purchase: costo del producto y del kardex = costo unitario con IVA.
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000037a01', 'owner-a-s1937@test.local');
insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-000000037a01', 'Tenant A S19-37');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000037a01', '10000000-0000-0000-0000-000000037a01', 'owner',
   '00000000-0000-0000-0000-000000037a01');
insert into public.warehouses (id, tenant_id, name, created_by) values
  ('20000000-0000-0000-0000-000000037a01', '10000000-0000-0000-0000-000000037a01', 'Principal',
   '00000000-0000-0000-0000-000000037a01');
insert into public.products (id, tenant_id, sku, name, cost, price, created_by) values
  ('40000000-0000-0000-0000-000000037a01', '10000000-0000-0000-0000-000000037a01', 'S1937-A', 'Miel',
   1, 5000, '00000000-0000-0000-0000-000000037a01'),
  ('40000000-0000-0000-0000-000000037a02', '10000000-0000-0000-0000-000000037a01', 'S1937-B', 'Cera',
   1, 0, '00000000-0000-0000-0000-000000037a01');
insert into public.suppliers (id, tenant_id, name, created_by) values
  ('60000000-0000-0000-0000-000000037a01', '10000000-0000-0000-0000-000000037a01', 'Apiario',
   '00000000-0000-0000-0000-000000037a01');
insert into public.purchases (id, tenant_id, supplier_id, status, issued_at, created_by) values
  ('70000000-0000-0000-0000-000000037a01', '10000000-0000-0000-0000-000000037a01',
   '60000000-0000-0000-0000-000000037a01', 'ordered', now(), '00000000-0000-0000-0000-000000037a01');
-- A: 1000 + 19% = 1190. B repetido: 2 × 100 y 2 × 200, sin IVA → promedio 150.
insert into public.purchase_items (tenant_id, purchase_id, product_id, qty, unit_cost, tax_rate) values
  ('10000000-0000-0000-0000-000000037a01', '70000000-0000-0000-0000-000000037a01',
   '40000000-0000-0000-0000-000000037a01', 3, 1000, 19),
  ('10000000-0000-0000-0000-000000037a01', '70000000-0000-0000-0000-000000037a01',
   '40000000-0000-0000-0000-000000037a02', 2, 100, 0),
  ('10000000-0000-0000-0000-000000037a01', '70000000-0000-0000-0000-000000037a01',
   '40000000-0000-0000-0000-000000037a02', 2, 200, 0);

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000037a01", "role": "authenticated"}';

select public.receive_purchase('70000000-0000-0000-0000-000000037a01', '20000000-0000-0000-0000-000000037a01');

reset role;
select is(
  (select cost from public.products where id = '40000000-0000-0000-0000-000000037a01'),
  1190.00::numeric, 'C1: costo del producto = costo unitario con IVA');
select is(
  (select unit_cost from public.stock_movements
   where ref_type = 'purchase' and product_id = '40000000-0000-0000-0000-000000037a01'),
  1190.00::numeric, 'C2: el kardex entra con el costo con IVA');
select is(
  (select cost from public.products where id = '40000000-0000-0000-0000-000000037a02'),
  150.00::numeric, 'C3: producto repetido en la orden → promedio ponderado');

select * from finish();
rollback;
