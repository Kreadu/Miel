-- S19-28 — Categorías propias de cada inventario.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000028a01', 'owner-a-s1928@test.local');
insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-000000028a01', 'Tenant A S19-28');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000028a01', '10000000-0000-0000-0000-000000028a01', 'owner',
   '00000000-0000-0000-0000-000000028a01');

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000028a01", "role": "authenticated"}';

-- === C1: mismo nombre en dos inventarios distintos, permitido ===
insert into public.product_categories (id, tenant_id, inventory, name) values
  ('30000000-0000-0000-0000-000000028a01', '10000000-0000-0000-0000-000000028a01', 'productos', 'Varios'),
  ('30000000-0000-0000-0000-000000028a02', '10000000-0000-0000-0000-000000028a01', 'vehiculos', 'Varios');
select is(
  (select count(*)::int from public.product_categories where name = 'Varios'),
  2, 'C1: "Varios" existe en productos y en vehículos');

-- === C2: repetido dentro del mismo inventario, rechazado ===
select throws_ok(
  $$insert into public.product_categories (tenant_id, inventory, name)
    values ('10000000-0000-0000-0000-000000028a01', 'productos', 'Varios')$$,
  '23505', null, 'C2: no se repite el nombre en el mismo inventario');

-- === C3: un ítem acepta una categoría de su inventario ===
select lives_ok(
  $$insert into public.products (tenant_id, sku, name, kind, inventory, category_id)
    values ('10000000-0000-0000-0000-000000028a01', 'S1928-V', 'Camioneta', 'other', 'vehiculos',
            '30000000-0000-0000-0000-000000028a02')$$,
  'C3: vehículo con categoría de vehículos');

-- === C4: y rechaza una de otro inventario ===
select throws_ok(
  $$insert into public.products (tenant_id, sku, name, kind, inventory, category_id)
    values ('10000000-0000-0000-0000-000000028a01', 'S1928-P', 'Miel', 'resale', 'productos',
            '30000000-0000-0000-0000-000000028a02')$$,
  'P0001', 'category_inventory_mismatch', 'C4: producto con categoría de vehículos, rechazado');

-- === C5: borrar la categoría deja el ítem sin categoría (no falla el trigger) ===
delete from public.product_categories where id = '30000000-0000-0000-0000-000000028a02';
select ok(
  (select category_id is null from public.products where sku = 'S1928-V'),
  'C5: el vehículo queda sin categoría');

select * from finish();
rollback;
