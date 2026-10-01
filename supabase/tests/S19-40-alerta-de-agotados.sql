-- S19-40 — low_stock_alerts incluye los agotados aunque su mínimo sea 0.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000019401', 'owner-s1940@test.local');
insert into public.tenants (id, name) values ('10000000-0000-0000-0000-000000019401', 'Tenant S19-40');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000019401', '10000000-0000-0000-0000-000000019401', 'owner',
   '00000000-0000-0000-0000-000000019401');
insert into public.warehouses (id, tenant_id, name, created_by) values
  ('30000000-0000-0000-0000-000000019401', '10000000-0000-0000-0000-000000019401', 'Bodega',
   '00000000-0000-0000-0000-000000019401');

-- agotado (mínimo 0), nunca ingresado (mínimo 0), bajo el mínimo (mínimo 5), con stock (mínimo 0)
insert into public.products (id, tenant_id, sku, name, min_stock, created_by) values
  ('40000000-0000-0000-0000-000000019401', '10000000-0000-0000-0000-000000019401', 'AGO', 'Agotado', 0,
   '00000000-0000-0000-0000-000000019401'),
  ('40000000-0000-0000-0000-000000019402', '10000000-0000-0000-0000-000000019401', 'NUN', 'Nunca', 0,
   '00000000-0000-0000-0000-000000019401'),
  ('40000000-0000-0000-0000-000000019403', '10000000-0000-0000-0000-000000019401', 'BAJ', 'Bajo', 5,
   '00000000-0000-0000-0000-000000019401'),
  ('40000000-0000-0000-0000-000000019404', '10000000-0000-0000-0000-000000019401', 'CON', 'Con stock', 0,
   '00000000-0000-0000-0000-000000019401');

insert into public.stock_movements (tenant_id, product_id, warehouse_id, kind, qty, unit_cost, created_by) values
  ('10000000-0000-0000-0000-000000019401', '40000000-0000-0000-0000-000000019401', '30000000-0000-0000-0000-000000019401', 'in', 3, 1, '00000000-0000-0000-0000-000000019401'),
  ('10000000-0000-0000-0000-000000019401', '40000000-0000-0000-0000-000000019401', '30000000-0000-0000-0000-000000019401', 'out', -3, 1, '00000000-0000-0000-0000-000000019401'),
  ('10000000-0000-0000-0000-000000019401', '40000000-0000-0000-0000-000000019403', '30000000-0000-0000-0000-000000019401', 'in', 2, 1, '00000000-0000-0000-0000-000000019401'),
  ('10000000-0000-0000-0000-000000019401', '40000000-0000-0000-0000-000000019404', '30000000-0000-0000-0000-000000019401', 'in', 4, 1, '00000000-0000-0000-0000-000000019401');

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000019401", "role": "authenticated"}';

select is((select out_of_stock from public.low_stock_alerts where sku = 'AGO'), true,
  'agotado con mínimo 0: aparece y marcado agotado');
select is((select count(*)::int from public.low_stock_alerts where sku = 'NUN'), 0,
  'nunca ingresado: no aparece');
select is((select out_of_stock from public.low_stock_alerts where sku = 'BAJ'), false,
  'bajo el mínimo: aparece, no agotado');
select is((select count(*)::int from public.low_stock_alerts where sku = 'CON'), 0, 'con stock: no aparece');

select * from finish();
rollback;
