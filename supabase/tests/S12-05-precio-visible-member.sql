-- S12-05 — products_catalog deja de enmascarar price/tax_rate para member (solo cost sigue
-- oculto, ADR-029). Fixture dedicado, complementa las aserciones ya movidas a
-- S2-02-productos.sql. Ver specs/done/S12-05-precio-visible-member.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000f001', 'owner-f@test.local'),
  ('00000000-0000-0000-0000-00000000f002', 'member-f@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-00000000f001', 'Tenant F');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-00000000f001', '10000000-0000-0000-0000-00000000f001', 'owner',
   '00000000-0000-0000-0000-00000000f001'),
  ('00000000-0000-0000-0000-00000000f002', '10000000-0000-0000-0000-00000000f001', 'member',
   '00000000-0000-0000-0000-00000000f001');

insert into public.products (id, tenant_id, sku, name, cost, price, tax_rate, created_by) values
  ('20000000-0000-0000-0000-00000000f001', '10000000-0000-0000-0000-00000000f001',
   'SKU-F1', 'Producto F1', 60, 100, 19, '00000000-0000-0000-0000-00000000f001');

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000f002", "role": "authenticated"}';

-- === C1: member ve price/tax_rate reales vía la vista (necesario para operar el POS) ===
select is(
  (select price from public.products_catalog where id = '20000000-0000-0000-0000-00000000f001'),
  100.00::numeric, 'C1: member ve price real en products_catalog');

select is(
  (select tax_rate from public.products_catalog where id = '20000000-0000-0000-0000-00000000f001'),
  19.00::numeric, 'C1: member ve tax_rate real en products_catalog');

-- === C2: cost sigue oculto (null) para member — solo ese dato sigue siendo sensible ===
select is(
  (select cost from public.products_catalog where id = '20000000-0000-0000-0000-00000000f001'),
  null, 'C2: member ve cost como null en products_catalog');

-- === C3: aislamiento por tenant se conserva (member sin membership en un tenant ajeno) ===
select is(
  (select count(*)::int from public.products_catalog
   where tenant_id <> '10000000-0000-0000-0000-00000000f001'),
  0, 'C3: member no ve productos de tenants ajenos vía la vista');

-- === C4: la tabla base sigue negando price/cost directo (el GRANT columnar no cambió) ===
select throws_ok(
  $$select price from public.products where id = '20000000-0000-0000-0000-00000000f001'$$,
  '42501', null, 'C4: member sigue sin poder leer price directo de la tabla base');

select * from finish();
rollback;
