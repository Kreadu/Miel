-- S19-21 — Renombrar y eliminar categorías (solo owner/admin, aislamiento por tenant).
-- Nota (S2-01): UPDATE/DELETE bloqueados por USING no lanzan error, afectan 0 filas.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000021a01', 'owner-a-s1921@test.local'),
  ('00000000-0000-0000-0000-000000021a02', 'member-a-s1921@test.local'),
  ('00000000-0000-0000-0000-000000021b01', 'owner-b-s1921@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-000000021a01', 'Tenant A S19-21'),
  ('10000000-0000-0000-0000-000000021b01', 'Tenant B S19-21');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000021a01', '10000000-0000-0000-0000-000000021a01', 'owner',
   '00000000-0000-0000-0000-000000021a01'),
  ('00000000-0000-0000-0000-000000021a02', '10000000-0000-0000-0000-000000021a01', 'member',
   '00000000-0000-0000-0000-000000021a01'),
  ('00000000-0000-0000-0000-000000021b01', '10000000-0000-0000-0000-000000021b01', 'owner',
   '00000000-0000-0000-0000-000000021b01');

insert into public.product_categories (id, tenant_id, name, created_by) values
  ('30000000-0000-0000-0000-000000021a01', '10000000-0000-0000-0000-000000021a01', 'Dulces',
   '00000000-0000-0000-0000-000000021a01'),
  ('30000000-0000-0000-0000-000000021b01', '10000000-0000-0000-0000-000000021b01', 'Ajena',
   '00000000-0000-0000-0000-000000021b01');

insert into public.products (id, tenant_id, sku, name, unit, kind, category_id, created_by) values
  ('40000000-0000-0000-0000-000000021a01', '10000000-0000-0000-0000-000000021a01', 'S1921-1',
   'Miel', 'unidad', 'resale', '30000000-0000-0000-0000-000000021a01',
   '00000000-0000-0000-0000-000000021a01');

-- === member no renombra ni elimina ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000021a02", "role": "authenticated"}';

update public.product_categories set name = 'Hackeada' where id = '30000000-0000-0000-0000-000000021a01';
delete from public.product_categories where id = '30000000-0000-0000-0000-000000021a01';

select is(
  (select name from public.product_categories where id = '30000000-0000-0000-0000-000000021a01'),
  'Dulces', 'member no renombra ni elimina');

-- === owner renombra y elimina ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000021a01", "role": "authenticated"}';

update public.product_categories set name = 'Endulzantes' where id = '30000000-0000-0000-0000-000000021a01';
select is(
  (select name from public.product_categories where id = '30000000-0000-0000-0000-000000021a01'),
  'Endulzantes', 'owner renombra');

-- === owner no toca categorías de otro tenant ===
update public.product_categories set name = 'Robada' where id = '30000000-0000-0000-0000-000000021b01';
delete from public.product_categories where id = '30000000-0000-0000-0000-000000021b01';

delete from public.product_categories where id = '30000000-0000-0000-0000-000000021a01';
select is(
  (select count(*)::int from public.product_categories where id = '30000000-0000-0000-0000-000000021a01'),
  0, 'owner elimina');

select ok(
  (select category_id is null from public.products where id = '40000000-0000-0000-0000-000000021a01'),
  'el producto queda sin categoría, no se borra');

reset role;
select is(
  (select name from public.product_categories where id = '30000000-0000-0000-0000-000000021b01'),
  'Ajena', 'la categoría de otro tenant sigue intacta');

select is(
  (select count(*)::int from public.products where id = '40000000-0000-0000-0000-000000021a01'),
  1, 'el producto sigue existiendo');

select * from finish();
rollback;
