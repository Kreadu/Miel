-- S2-01 — Bodegas: tabla warehouses + RLS (select para todo el tenant, write solo owner/admin).
-- Ver specs/S2-01-bodegas.md, docs/arch/multitenancy-rls.md.
--
-- Nota: una UPDATE que no matchea filas por la clausula USING de RLS no lanza excepcion (solo
-- afecta 0 filas) — a diferencia de un INSERT, que si lanza 42501 al violar el WITH CHECK. Por
-- eso el rechazo de UPDATE se prueba verificando que el valor no cambio, no con throws_ok.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Fixtures: tenant A (owner + member) y tenant B (owner), cada uno con una bodega propia.
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

insert into public.warehouses (id, tenant_id, name, created_by) values
  ('20000000-0000-0000-0000-00000000aaa1', '10000000-0000-0000-0000-00000000aaa1', 'Bodega A',
   '00000000-0000-0000-0000-00000000aaa1'),
  ('20000000-0000-0000-0000-00000000bbb1', '10000000-0000-0000-0000-00000000bbb1', 'Bodega B',
   '00000000-0000-0000-0000-00000000bbb1');

-- === C1: owner crea bodega en su tenant (RLS permite) ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000aaa1", "role": "authenticated"}';

insert into public.warehouses (tenant_id, name) values
  ('10000000-0000-0000-0000-00000000aaa1', 'Bodega nueva');

select is(
  (select count(*)::int from public.warehouses
   where tenant_id = '10000000-0000-0000-0000-00000000aaa1'),
  2, 'C1: owner crea bodega en su tenant');

-- === C5: aislamiento — A no ve bodegas de B ===
select is(
  (select count(*)::int from public.warehouses
   where tenant_id = '10000000-0000-0000-0000-00000000bbb1'),
  0, 'C5: A no ve bodegas del tenant B');

-- === C3: owner edita el nombre de su bodega ===
update public.warehouses set name = 'Bodega A renombrada'
  where id = '20000000-0000-0000-0000-00000000aaa1';

select is(
  (select name from public.warehouses where id = '20000000-0000-0000-0000-00000000aaa1'),
  'Bodega A renombrada', 'C3: owner edita el nombre de su bodega');

select has_trigger('public', 'warehouses', 'warehouses_set_updated_at',
  'C3: trigger set_updated_at existe sobre warehouses');

-- === C4: owner archiva y reactiva su bodega (soft-delete, sin borrado físico) ===
update public.warehouses set active = false
  where id = '20000000-0000-0000-0000-00000000aaa1';

select is(
  (select active from public.warehouses where id = '20000000-0000-0000-0000-00000000aaa1'),
  false, 'C4: owner archiva su bodega (active=false)');

update public.warehouses set active = true
  where id = '20000000-0000-0000-0000-00000000aaa1';

select is(
  (select active from public.warehouses where id = '20000000-0000-0000-0000-00000000aaa1'),
  true, 'C4: owner reactiva su bodega (active=true)');

select is(
  (select count(*)::int from public.warehouses
   where id = '20000000-0000-0000-0000-00000000aaa1'),
  1, 'C4: archivar/reactivar no borra la fila');

-- === C5: A no puede escribir en el tenant B ===
select throws_ok(
  $$insert into public.warehouses (tenant_id, name)
    values ('10000000-0000-0000-0000-00000000bbb1', 'intrusa')$$,
  '42501', null, 'C5: A no puede escribir en el tenant B');

-- === C2: member ve el listado de su tenant (select amplio) ===
reset role;
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000aaa2", "role": "authenticated"}';

select is(
  (select count(*)::int from public.warehouses
   where tenant_id = '10000000-0000-0000-0000-00000000aaa1'),
  2, 'C2: member ve el listado de bodegas de su tenant');

-- === C2: member NO puede crear bodega (RLS rechaza, INSERT viola WITH CHECK) ===
select throws_ok(
  $$insert into public.warehouses (tenant_id, name)
    values ('10000000-0000-0000-0000-00000000aaa1', 'no-deberia-crear')$$,
  '42501', null,
  'C2: member no puede crear bodega (RLS la rechaza)');

-- === C2: member NO puede archivar bodega (UPDATE no matchea filas por USING, sin excepción) ===
update public.warehouses set active = false
  where id = '20000000-0000-0000-0000-00000000aaa1';

select is(
  (select active from public.warehouses where id = '20000000-0000-0000-0000-00000000aaa1'),
  true, 'C2: member no puede archivar bodega (el valor no cambia)');

select * from finish();
rollback;
