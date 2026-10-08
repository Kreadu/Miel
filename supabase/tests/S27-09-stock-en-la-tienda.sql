-- S27-09 — store_catalog devuelve el stock total (todas las bodegas, nunca negativo).
-- Ver specs/done/S27-09-stock-en-la-tienda.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000027901', 'o-s2709@test.local');
insert into public.tenants (id, name, store_enabled, store_slug) values ('10000000-0000-0000-0000-000000027901', 'Dulce', true, 'dulce-2709');
insert into public.products (id, tenant_id, sku, name, price, inventory, sales_channel, created_by) values
  ('30000000-0000-0000-0000-000000027901', '10000000-0000-0000-0000-000000027901', 'A', 'Dos bodegas', 1000, 'productos', 'online', '00000000-0000-0000-0000-000000027901'),
  ('30000000-0000-0000-0000-000000027902', '10000000-0000-0000-0000-000000027901', 'B', 'Local sin stock', 1000, 'productos', 'in_store', '00000000-0000-0000-0000-000000027901'),
  ('30000000-0000-0000-0000-000000027903', '10000000-0000-0000-0000-000000027901', 'C', 'Negativo', 1000, 'productos', 'both', '00000000-0000-0000-0000-000000027901');
insert into public.warehouses (id, tenant_id, name, created_by) values
  ('40000000-0000-0000-0000-000000027901', '10000000-0000-0000-0000-000000027901', 'W1', '00000000-0000-0000-0000-000000027901'),
  ('40000000-0000-0000-0000-000000027902', '10000000-0000-0000-0000-000000027901', 'W2', '00000000-0000-0000-0000-000000027901');
insert into public.stock_movements (tenant_id, product_id, warehouse_id, kind, qty, unit_cost, created_by) values
  ('10000000-0000-0000-0000-000000027901', '30000000-0000-0000-0000-000000027901', '40000000-0000-0000-0000-000000027901', 'in', 7, 1, '00000000-0000-0000-0000-000000027901'),
  ('10000000-0000-0000-0000-000000027901', '30000000-0000-0000-0000-000000027901', '40000000-0000-0000-0000-000000027902', 'in', 5, 1, '00000000-0000-0000-0000-000000027901'),
  ('10000000-0000-0000-0000-000000027901', '30000000-0000-0000-0000-000000027903', '40000000-0000-0000-0000-000000027901', 'adjust', -2, 1, '00000000-0000-0000-0000-000000027901');

set local role anon;
set local "request.jwt.claims" to '{"role": "anon"}';
select is((select stock from public.store_catalog('dulce-2709') where name = 'Dos bodegas'), 12.000::numeric, 'C1: suma de todas las bodegas');
select is((select stock from public.store_catalog('dulce-2709') where name = 'Local sin stock'), 0::numeric, 'C1: sin movimientos = 0 (también de tienda física)');
select is((select stock from public.store_catalog('dulce-2709') where name = 'Negativo'), 0::numeric, 'C1: nunca negativo');

select * from finish();
rollback;
