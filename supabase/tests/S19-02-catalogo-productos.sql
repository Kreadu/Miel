-- S19-02 — Catalogo: products gana photo_url/discount_percent + bucket product-photos.
-- Ver specs/S19-02-catalogo-productos.md, ADR-035.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000c0001', 'admin-cat@test.local'),
  ('00000000-0000-0000-0000-0000000c0002', 'member-cat@test.local');

insert into public.tenants (id, name) values
  ('20000000-0000-0000-0000-0000000c0001', 'Tienda Catalogo');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-0000000c0001', '20000000-0000-0000-0000-0000000c0001', 'owner',
   '00000000-0000-0000-0000-0000000c0001'),
  ('00000000-0000-0000-0000-0000000c0002', '20000000-0000-0000-0000-0000000c0001', 'member',
   '00000000-0000-0000-0000-0000000c0001');

-- === C1: admin inserta producto de catalogo con photo_url/discount_percent ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-0000000c0001", "role": "authenticated"}';

insert into public.products (
  tenant_id, sku, name, description, unit, kind, cost, price, tax_rate, min_stock,
  photo_url, discount_percent
) values (
  '20000000-0000-0000-0000-0000000c0001', 'CAT-TEST01', 'Miel 500g', 'Miel pura', 'unidad',
  'resale', 0, 25000, 0, 0, 'https://example.test/foto.jpg', 10
);

select is(
  (select discount_percent from public.products where sku = 'CAT-TEST01'),
  10::numeric, 'C1: discount_percent se guarda como se envio');

select is(
  (select photo_url from public.products where sku = 'CAT-TEST01'),
  'https://example.test/foto.jpg', 'C1: photo_url se guarda como se envio');

-- === C5: member no puede insertar (RLS products_admin_write, sin cambios) ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-0000000c0002", "role": "authenticated"}';

select throws_ok(
  $$insert into public.products (tenant_id, sku, name, price)
    values ('20000000-0000-0000-0000-0000000c0001', 'CAT-TEST02', 'Producto member', 1000)$$,
  '42501', null,
  'C5: member no puede insertar un producto de catalogo');

-- === products_catalog expone photo_url/discount_percent sin enmascarar para member ===
select is(
  (select discount_percent from public.products_catalog where sku = 'CAT-TEST01'),
  10::numeric, 'products_catalog: discount_percent visible para member (no es sensible)');

select is(
  (select photo_url from public.products_catalog where sku = 'CAT-TEST01'),
  'https://example.test/foto.jpg', 'products_catalog: photo_url visible para member');

select is(
  (select cost from public.products_catalog where sku = 'CAT-TEST01'),
  null, 'products_catalog: cost sigue enmascarado para member (ADR-029, sin cambios)');

-- === C6: CHECK de discount_percent (0-100) ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-0000000c0001", "role": "authenticated"}';

select throws_ok(
  $$insert into public.products (tenant_id, sku, name, price, discount_percent)
    values ('20000000-0000-0000-0000-0000000c0001', 'CAT-TEST03', 'Descuento invalido', 1000, 150)$$,
  '23514', null,
  'C6: discount_percent > 100 rechazado por el CHECK');

select throws_ok(
  $$insert into public.products (tenant_id, sku, name, price, discount_percent)
    values ('20000000-0000-0000-0000-0000000c0001', 'CAT-TEST04', 'Descuento negativo', 1000, -1)$$,
  '23514', null,
  'C6: discount_percent negativo rechazado por el CHECK');

-- === Storage: bucket product-photos existe y es publico ===
select is(
  (select public from storage.buckets where id = 'product-photos'),
  true, 'bucket product-photos existe y es publico');

select * from finish();
rollback;
