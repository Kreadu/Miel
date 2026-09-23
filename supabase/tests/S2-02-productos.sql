-- S2-02 — Productos: tabla products + vista products_catalog (columnas cost/price/tax_rate
-- enmascaradas a null para member) + RLS (select para todo el tenant, write solo owner/admin).
-- Ver specs/S2-02-productos.md, docs/arch/multitenancy-rls.md, docs/arch/permisos-roles.md.
--
-- Nota (heredada de S2-01): una UPDATE que no matchea filas por la clausula USING de RLS no
-- lanza excepcion (solo afecta 0 filas) — a diferencia de un INSERT, que si lanza 42501 al
-- violar el WITH CHECK. Por eso el rechazo de UPDATE se prueba verificando que el valor no
-- cambio, no con throws_ok.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- Fixtures: tenant A (owner + member) y tenant B (owner), cada uno con un producto propio.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000aaa1', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000aaa2', 'member-a@test.local'),
  ('00000000-0000-0000-0000-00000000bbb1', 'owner-b@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-00000000aaa1', 'Tenant A'),
  ('10000000-0000-0000-0000-00000000bbb1', 'Tenant B');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-00000000aaa1', '10000000-0000-0000-0000-00000000aaa1', 'owner',
   '00000000-0000-0000-0000-00000000aaa1'),
  ('00000000-0000-0000-0000-00000000aaa2', '10000000-0000-0000-0000-00000000aaa1', 'member',
   '00000000-0000-0000-0000-00000000aaa1'),
  ('00000000-0000-0000-0000-00000000bbb1', '10000000-0000-0000-0000-00000000bbb1', 'owner',
   '00000000-0000-0000-0000-00000000bbb1');

insert into public.products (id, tenant_id, sku, name, cost, price, created_by) values
  ('20000000-0000-0000-0000-00000000aaa1', '10000000-0000-0000-0000-00000000aaa1',
   'SKU-A', 'Producto A', 100, 200, '00000000-0000-0000-0000-00000000aaa1'),
  ('20000000-0000-0000-0000-00000000bbb1', '10000000-0000-0000-0000-00000000bbb1',
   'SKU-B', 'Producto B', 300, 400, '00000000-0000-0000-0000-00000000bbb1');

-- === C1: owner crea producto en su tenant (RLS permite) ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000aaa1", "role": "authenticated"}';

insert into public.products (tenant_id, sku, name) values
  ('10000000-0000-0000-0000-00000000aaa1', 'SKU-NUEVO', 'Producto nuevo');

select is(
  (select count(*)::int from public.products
   where tenant_id = '10000000-0000-0000-0000-00000000aaa1'),
  2, 'C1: owner crea producto en su tenant');

-- === C5: aislamiento — A no ve productos de B ===
select is(
  (select count(*)::int from public.products
   where tenant_id = '10000000-0000-0000-0000-00000000bbb1'),
  0, 'C5: A no ve productos del tenant B');

-- === C5: SKU único por tenant — duplicado dentro del mismo tenant falla ===
select throws_ok(
  $$insert into public.products (tenant_id, sku, name)
    values ('10000000-0000-0000-0000-00000000aaa1', 'SKU-A', 'Duplicado')$$,
  '23505', null, 'C5: SKU duplicado en el mismo tenant lanza unique violation');

-- === C5: el mismo SKU en el tenant B no choca (unicidad es por tenant) ===
reset role;
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000bbb1", "role": "authenticated"}';

insert into public.products (tenant_id, sku, name) values
  ('10000000-0000-0000-0000-00000000bbb1', 'SKU-A', 'Repetido en B');

select is(
  (select count(*)::int from public.products
   where tenant_id = '10000000-0000-0000-0000-00000000bbb1' and sku = 'SKU-A'),
  1, 'C5: el mismo SKU se permite en un tenant distinto');

-- === C3: owner edita campos de su producto ===
reset role;
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000aaa1", "role": "authenticated"}';

update public.products set name = 'Producto A renombrado', price = 250
  where id = '20000000-0000-0000-0000-00000000aaa1';

select is(
  (select name from public.products where id = '20000000-0000-0000-0000-00000000aaa1'),
  'Producto A renombrado', 'C3: owner edita el nombre de su producto');

select has_trigger('public', 'products', 'products_set_updated_at',
  'C3: trigger set_updated_at existe sobre products');

-- === C4: owner archiva y reactiva su producto (soft-delete, sin borrado físico) ===
update public.products set active = false
  where id = '20000000-0000-0000-0000-00000000aaa1';

select is(
  (select active from public.products where id = '20000000-0000-0000-0000-00000000aaa1'),
  false, 'C4: owner archiva su producto (active=false)');

update public.products set active = true
  where id = '20000000-0000-0000-0000-00000000aaa1';

select is(
  (select count(*)::int from public.products
   where id = '20000000-0000-0000-0000-00000000aaa1' and active = true),
  1, 'C4: archivar/reactivar no borra la fila');

-- === C5: A no puede escribir en el tenant B ===
select throws_ok(
  $$insert into public.products (tenant_id, sku, name)
    values ('10000000-0000-0000-0000-00000000bbb1', 'SKU-INTRUSO', 'intrusa')$$,
  '42501', null, 'C5: A no puede escribir en el tenant B');

-- === C2: member ve el listado de su tenant vía la vista (select amplio) ===
reset role;
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000aaa2", "role": "authenticated"}';

select is(
  (select count(*)::int from public.products_catalog
   where tenant_id = '10000000-0000-0000-0000-00000000aaa1'),
  2, 'C2: member ve el listado de productos de su tenant vía la vista');

-- === C5: aislamiento vía la vista — A no ve productos de B a través de products_catalog ===
-- (regresión: FORCE ROW LEVEL SECURITY no basta porque el dueño de la tabla tiene
-- rolbypassrls en Supabase; el aislamiento debe repetirse en el `where` de la vista misma).
select is(
  (select count(*)::int from public.products_catalog
   where tenant_id = '10000000-0000-0000-0000-00000000bbb1'),
  0, 'C5: A no ve productos del tenant B a través de products_catalog');

-- === C2: member ve cost como null pero price/tax_rate reales en la vista (ADR-029) ===
select is(
  (select cost from public.products_catalog
   where id = '20000000-0000-0000-0000-00000000aaa1'),
  null, 'C2: member ve cost como null en products_catalog');

select is(
  (select price from public.products_catalog
   where id = '20000000-0000-0000-0000-00000000aaa1'),
  250.00::numeric, 'C2: member ve price real en products_catalog (ADR-029)');

select is(
  (select tax_rate from public.products_catalog
   where id = '20000000-0000-0000-0000-00000000aaa1'),
  19.00::numeric, 'C2: member ve tax_rate real (default 19) en products_catalog (ADR-029)');

-- === C2: member NO puede leer cost directo de la tabla base (falta privilegio de columna) ===
select throws_ok(
  $$select cost from public.products where id = '20000000-0000-0000-0000-00000000aaa1'$$,
  '42501', null, 'C2: member no puede leer cost directo de la tabla base');

-- === C2: member NO puede crear producto (RLS rechaza, INSERT viola WITH CHECK) ===
select throws_ok(
  $$insert into public.products (tenant_id, sku, name)
    values ('10000000-0000-0000-0000-00000000aaa1', 'SKU-MEMBER', 'no-deberia-crear')$$,
  '42501', null,
  'C2: member no puede crear producto (RLS la rechaza)');

-- === C2: member NO puede archivar producto (UPDATE no matchea filas por USING, sin excepción) ===
update public.products set active = false
  where id = '20000000-0000-0000-0000-00000000aaa1';

select is(
  (select active from public.products where id = '20000000-0000-0000-0000-00000000aaa1'),
  true, 'C2: member no puede archivar producto (el valor no cambia)');

select * from finish();
rollback;
