-- S19-26 — Tipos de inventario sobre products + datos de activos.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000026a01', 'owner-a-s1926@test.local'),
  ('00000000-0000-0000-0000-000000026b01', 'owner-b-s1926@test.local');
insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-000000026a01', 'Tenant A S19-26'),
  ('10000000-0000-0000-0000-000000026b01', 'Tenant B S19-26');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000026a01', '10000000-0000-0000-0000-000000026a01', 'owner',
   '00000000-0000-0000-0000-000000026a01'),
  ('00000000-0000-0000-0000-000000026b01', '10000000-0000-0000-0000-000000026b01', 'owner',
   '00000000-0000-0000-0000-000000026b01');

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000026a01", "role": "authenticated"}';

-- === C1: sin inventario explícito, el producto va a "productos" ===
insert into public.products (tenant_id, sku, name, kind)
values ('10000000-0000-0000-0000-000000026a01', 'S1926-P', 'Miel', 'resale');
select is(
  (select inventory from public.products_catalog where sku = 'S1926-P'),
  'productos', 'C1: default inventory = productos');

-- === C2: un vehículo guarda sus datos y se ve en products_catalog ===
insert into public.products (tenant_id, sku, name, kind, inventory, plate, brand, model, vehicle_year, color)
values ('10000000-0000-0000-0000-000000026a01', 'S1926-V', 'Camioneta', 'other', 'vehiculos',
        'ABC123', 'Toyota', 'Hilux', 2022, 'Blanco');
select is(
  (select plate || '|' || brand || '|' || vehicle_year::text from public.products_catalog where sku = 'S1926-V'),
  'ABC123|Toyota|2022', 'C2: datos del vehículo visibles en la vista');

-- === C3: inventario inválido o kind inválido se rechazan ===
select throws_ok(
  $$insert into public.products (tenant_id, sku, name, kind, inventory)
    values ('10000000-0000-0000-0000-000000026a01', 'S1926-X', 'X', 'other', 'juguetes')$$,
  '23514', null, 'C3: inventario fuera de la lista');
select throws_ok(
  $$insert into public.products (tenant_id, sku, name, kind)
    values ('10000000-0000-0000-0000-000000026a01', 'S1926-Y', 'Y', 'mueble')$$,
  '23514', null, 'C3: kind fuera de la lista');

-- === C4: kind 'other' permitido ===
select lives_ok(
  $$insert into public.products (tenant_id, sku, name, kind, inventory)
    values ('10000000-0000-0000-0000-000000026a01', 'S1926-O', 'Escritorio', 'other', 'mobiliario')$$,
  'C4: mobiliario con kind other');

-- === C5: aislamiento en la vista ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000026b01", "role": "authenticated"}';
select is(
  (select count(*)::int from public.products_catalog where sku like 'S1926-%'),
  0, 'C5: B no ve los ítems de A');

select * from finish();
rollback;
