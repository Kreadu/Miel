-- S15-01 — supplier_products: aislamiento por tenant, RLS por rol (solo owner/admin gestiona
-- a mano), FK compuesta evita asociar producto/proveedor de otro tenant.
-- Ver specs/S15-01-catalogo-por-proveedor.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- Fixtures: tenant A (owner + member) y tenant B (owner), productos y proveedores.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a001', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000a002', 'member-a@test.local'),
  ('00000000-0000-0000-0000-00000000b001', 'owner-b@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-00000000a001', 'Tenant A'),
  ('10000000-0000-0000-0000-00000000b001', 'Tenant B');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-00000000a001', '10000000-0000-0000-0000-00000000a001', 'owner',
   '00000000-0000-0000-0000-00000000a001'),
  ('00000000-0000-0000-0000-00000000a002', '10000000-0000-0000-0000-00000000a001', 'member',
   '00000000-0000-0000-0000-00000000a001'),
  ('00000000-0000-0000-0000-00000000b001', '10000000-0000-0000-0000-00000000b001', 'owner',
   '00000000-0000-0000-0000-00000000b001');

insert into public.products (id, tenant_id, sku, name, cost, price, created_by) values
  ('40000000-0000-0000-0000-00000000a001', '10000000-0000-0000-0000-00000000a001', 'SKU-A1',
   'Producto A1', 100, 200, '00000000-0000-0000-0000-00000000a001'),
  ('40000000-0000-0000-0000-00000000a002', '10000000-0000-0000-0000-00000000a001', 'SKU-A2',
   'Producto A2', 50, 90, '00000000-0000-0000-0000-00000000a001'),
  ('40000000-0000-0000-0000-00000000b001', '10000000-0000-0000-0000-00000000b001', 'SKU-B1',
   'Producto B1', 300, 400, '00000000-0000-0000-0000-00000000b001');

insert into public.suppliers (id, tenant_id, name, created_by) values
  ('20000000-0000-0000-0000-00000000a001', '10000000-0000-0000-0000-00000000a001',
   'Proveedor A', '00000000-0000-0000-0000-00000000a001'),
  ('20000000-0000-0000-0000-00000000b001', '10000000-0000-0000-0000-00000000b001',
   'Proveedor B', '00000000-0000-0000-0000-00000000b001');

-- Fila preexistente del tenant B (rol postgres bypasa RLS).
insert into public.supplier_products (tenant_id, supplier_id, product_id, created_by) values
  ('10000000-0000-0000-0000-00000000b001', '20000000-0000-0000-0000-00000000b001',
   '40000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000b001');

-- === Simular al owner del tenant A ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000a001", "role": "authenticated"}';

-- C1: owner de A asocia un producto de su propio tenant.
select lives_ok(
  $$insert into public.supplier_products (tenant_id, supplier_id, product_id) values
    ('10000000-0000-0000-0000-00000000a001', '20000000-0000-0000-0000-00000000a001',
     '40000000-0000-0000-0000-00000000a001')$$,
  'C1: owner de A asocia producto propio');

-- C2: aislamiento de lectura — A no ve la fila de B.
select is(
  (select count(*)::int from public.supplier_products
   where tenant_id = '10000000-0000-0000-0000-00000000b001'),
  0, 'C2: A no ve filas del tenant B');

-- C3: owner de A no puede asociar un producto que pertenece al tenant B (FK compuesta).
select throws_ok(
  $$insert into public.supplier_products (tenant_id, supplier_id, product_id) values
    ('10000000-0000-0000-0000-00000000a001', '20000000-0000-0000-0000-00000000a001',
     '40000000-0000-0000-0000-00000000b001')$$,
  '23503', null, 'C3: producto de otro tenant es rechazado (FK compuesta)');

-- C4: owner de A borra la asociación que creó.
select lives_ok(
  $$delete from public.supplier_products
    where tenant_id = '10000000-0000-0000-0000-00000000a001'
      and supplier_id = '20000000-0000-0000-0000-00000000a001'
      and product_id = '40000000-0000-0000-0000-00000000a001'$$,
  'C4: owner de A borra la asociación que creó');

-- Fixture: reasociar el mismo par (aún como owner de A, RLS lo permite) para el bloque de member.
insert into public.supplier_products (tenant_id, supplier_id, product_id, created_by) values
  ('10000000-0000-0000-0000-00000000a001', '20000000-0000-0000-0000-00000000a001',
   '40000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000a001');

-- === Simular al member del tenant A ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000a002", "role": "authenticated"}';

select is(
  (select count(*)::int from public.supplier_products
   where tenant_id = '10000000-0000-0000-0000-00000000a001'),
  1, 'C5: member ve las filas de su tenant');

-- C6: member no puede insertar (gestionar catálogos = solo owner/admin). Usa el producto A2
-- (no A1) para que el rechazo sea inequívocamente RLS y no un choque con el unique existente.
select throws_ok(
  $$insert into public.supplier_products (tenant_id, supplier_id, product_id) values
    ('10000000-0000-0000-0000-00000000a001', '20000000-0000-0000-0000-00000000a001',
     '40000000-0000-0000-0000-00000000a002')$$,
  '42501', null, 'C6: member no puede asociar (RLS admin-only)');

-- C7: member no puede borrar. La política USING de delete filtra en silencio (no lanza
-- excepción): un DELETE que no matchea ninguna fila visible simplemente afecta 0 filas.
delete from public.supplier_products where tenant_id = '10000000-0000-0000-0000-00000000a001';

select is(
  (select count(*)::int from public.supplier_products
   where tenant_id = '10000000-0000-0000-0000-00000000a001'),
  1, 'C7: member no puede borrar — la fila del tenant sigue intacta');

select * from finish();
rollback;
