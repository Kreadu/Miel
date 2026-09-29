-- S19-05 — Canal de venta por producto: online, in_store, o both.
-- Ver specs/S19-05-canal-de-venta-por-producto.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000d0001', 'admin-canal@test.local');

insert into public.tenants (id, name) values
  ('20000000-0000-0000-0000-0000000d0001', 'Tienda Canal');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-0000000d0001', '20000000-0000-0000-0000-0000000d0001', 'owner',
   '00000000-0000-0000-0000-0000000d0001');

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-0000000d0001", "role": "authenticated"}';

-- === C1: default es 'both' (retrocompatible) ===
insert into public.products (tenant_id, sku, name, price)
values ('20000000-0000-0000-0000-0000000d0001', 'CANAL-01', 'Producto sin canal explicito', 1000);

select is(
  (select sales_channel from public.products where sku = 'CANAL-01'),
  'both', 'C1: default de sales_channel es both');

-- === C2: valores validos aceptados ===
insert into public.products (tenant_id, sku, name, price, sales_channel)
values ('20000000-0000-0000-0000-0000000d0001', 'CANAL-02', 'Solo online', 1000, 'online');

insert into public.products (tenant_id, sku, name, price, sales_channel)
values ('20000000-0000-0000-0000-0000000d0001', 'CANAL-03', 'Solo tienda', 1000, 'in_store');

select is(
  (select sales_channel from public.products where sku = 'CANAL-02'),
  'online', 'C2: online se guarda correctamente');

select is(
  (select sales_channel from public.products where sku = 'CANAL-03'),
  'in_store', 'C2: in_store se guarda correctamente');

-- === C3: valor invalido rechazado por el CHECK ===
select throws_ok(
  $$insert into public.products (tenant_id, sku, name, price, sales_channel)
    values ('20000000-0000-0000-0000-0000000d0001', 'CANAL-04', 'Canal invalido', 1000, 'tienda')$$,
  '23514', null,
  'C3: un sales_channel fuera del enum es rechazado por el CHECK');

-- === products_catalog expone sales_channel ===
select is(
  (select sales_channel from public.products_catalog where sku = 'CANAL-02'),
  'online', 'products_catalog: sales_channel visible');

select * from finish();
rollback;
