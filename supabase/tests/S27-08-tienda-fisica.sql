-- S27-08 — Los productos "solo tienda física" se ven en el catálogo web (publicidad), pero no se
-- pueden pedir por la web. Ver specs/S27-08-tienda-fisica-y-pie-kreadu.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000027801', 'o-s2708@test.local');
insert into public.tenants (id, name, store_enabled, store_slug, store_pay_in_store) values
  ('10000000-0000-0000-0000-000000027801', 'Dulce', true, 'dulce-2708', true);
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000027801', '10000000-0000-0000-0000-000000027801', 'owner', '00000000-0000-0000-0000-000000027801');
insert into public.products (id, tenant_id, sku, name, price, inventory, sales_channel, created_by) values
  ('30000000-0000-0000-0000-000000027801', '10000000-0000-0000-0000-000000027801', 'W', 'Web', 1000, 'productos', 'online', '00000000-0000-0000-0000-000000027801'),
  ('30000000-0000-0000-0000-000000027802', '10000000-0000-0000-0000-000000027801', 'L', 'Local', 2000, 'productos', 'in_store', '00000000-0000-0000-0000-000000027801');

set local role anon;
set local "request.jwt.claims" to '{"role": "anon"}';

select is((select count(*)::int from public.store_catalog('dulce-2708')), 2, 'C1: se ven los de la web y los de la tienda física');
select is((select sales_channel from public.store_catalog('dulce-2708') where name = 'Local'), 'in_store', 'C1: con su canal');
select is((select sales_channel from public.store_catalog('dulce-2708') where name = 'Web'), 'online', 'C1: el de la web también');
select throws_like(
  $$select * from public.place_store_order('dulce-2708', '{"name": "Eva", "phone": "3200000001"}'::jsonb,
      '[{"product_id": "30000000-0000-0000-0000-000000027802", "qty": 1}]'::jsonb, 'pickup', 'in_store', null, null)$$,
  'product_unavailable%', 'C1: no se puede pedir por la web');

select * from finish();
rollback;
