-- S3-01 — Proveedores: tabla suppliers + RLS (select para todo el tenant, write solo
-- owner/admin) + NIT único por tenant cuando está presente.
-- Ver specs/done/S3-01-proveedores.md, docs/arch/multitenancy-rls.md.
--
-- Nota (ya documentada en S2-01): una UPDATE que no matchea filas por la clausula USING de
-- RLS no lanza excepcion (solo afecta 0 filas) — a diferencia de un INSERT, que si lanza
-- 42501 al violar el WITH CHECK. Por eso el rechazo de UPDATE se prueba verificando que el
-- valor no cambio, no con throws_ok.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Fixtures: tenant A (owner + member) y tenant B (owner), cada uno con un proveedor propio.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000ccc1', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000ccc2', 'member-a@test.local'),
  ('00000000-0000-0000-0000-00000000ddd1', 'owner-b@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-00000000ccc1', 'Tenant A'),
  ('10000000-0000-0000-0000-00000000ddd1', 'Tenant B');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-00000000ccc1', '10000000-0000-0000-0000-00000000ccc1', 'owner',
   '00000000-0000-0000-0000-00000000ccc1'),
  ('00000000-0000-0000-0000-00000000ccc2', '10000000-0000-0000-0000-00000000ccc1', 'member',
   '00000000-0000-0000-0000-00000000ccc1'),
  ('00000000-0000-0000-0000-00000000ddd1', '10000000-0000-0000-0000-00000000ddd1', 'owner',
   '00000000-0000-0000-0000-00000000ddd1');

insert into public.suppliers (id, tenant_id, name, nit, created_by) values
  ('20000000-0000-0000-0000-00000000ccc1', '10000000-0000-0000-0000-00000000ccc1',
   'Proveedor A', '900111222', '00000000-0000-0000-0000-00000000ccc1'),
  ('20000000-0000-0000-0000-00000000ddd1', '10000000-0000-0000-0000-00000000ddd1',
   'Proveedor B', '900333444', '00000000-0000-0000-0000-00000000ddd1');

-- === C1: owner crea proveedor en su tenant (RLS permite) ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000ccc1", "role": "authenticated"}';

insert into public.suppliers (tenant_id, name) values
  ('10000000-0000-0000-0000-00000000ccc1', 'Proveedor nuevo');

select is(
  (select count(*)::int from public.suppliers
   where tenant_id = '10000000-0000-0000-0000-00000000ccc1'),
  2, 'C1: owner crea proveedor en su tenant');

-- === C2: NIT duplicado en el mismo tenant rechazado ===
select throws_ok(
  $$insert into public.suppliers (tenant_id, name, nit)
    values ('10000000-0000-0000-0000-00000000ccc1', 'Proveedor duplicado', '900111222')$$,
  '23505', null, 'C2: NIT duplicado en el mismo tenant es rechazado');

-- === C2: dos proveedores sin NIT (NULL) conviven sin conflicto ===
insert into public.suppliers (tenant_id, name) values
  ('10000000-0000-0000-0000-00000000ccc1', 'Sin NIT uno'),
  ('10000000-0000-0000-0000-00000000ccc1', 'Sin NIT dos');

-- 3 en total: "Proveedor nuevo" (C1, sin nit) + los 2 nuevos de este bloque.
select is(
  (select count(*)::int from public.suppliers
   where tenant_id = '10000000-0000-0000-0000-00000000ccc1' and nit is null),
  3, 'C2: proveedores sin NIT conviven sin conflicto');

-- === C6: aislamiento — A no ve proveedores de B ===
select is(
  (select count(*)::int from public.suppliers
   where tenant_id = '10000000-0000-0000-0000-00000000ddd1'),
  0, 'C6: A no ve proveedores del tenant B');

-- === C4: owner edita los datos de su proveedor ===
update public.suppliers set name = 'Proveedor A renombrado', email = 'contacto@proveedor-a.test'
  where id = '20000000-0000-0000-0000-00000000ccc1';

select is(
  (select name from public.suppliers where id = '20000000-0000-0000-0000-00000000ccc1'),
  'Proveedor A renombrado', 'C4: owner edita el nombre de su proveedor');

select has_trigger('public', 'suppliers', 'suppliers_set_updated_at',
  'C4: trigger set_updated_at existe sobre suppliers');

-- === C5: owner archiva y reactiva su proveedor (soft-delete, sin borrado físico) ===
update public.suppliers set active = false
  where id = '20000000-0000-0000-0000-00000000ccc1';

select is(
  (select active from public.suppliers where id = '20000000-0000-0000-0000-00000000ccc1'),
  false, 'C5: owner archiva su proveedor (active=false)');

update public.suppliers set active = true
  where id = '20000000-0000-0000-0000-00000000ccc1';

select is(
  (select active from public.suppliers where id = '20000000-0000-0000-0000-00000000ccc1'),
  true, 'C5: owner reactiva su proveedor (active=true)');

select is(
  (select count(*)::int from public.suppliers
   where id = '20000000-0000-0000-0000-00000000ccc1'),
  1, 'C5: archivar/reactivar no borra la fila');

-- === C6: A no puede escribir en el tenant B ===
select throws_ok(
  $$insert into public.suppliers (tenant_id, name)
    values ('10000000-0000-0000-0000-00000000ddd1', 'intruso')$$,
  '42501', null, 'C6: A no puede escribir en el tenant B');

-- === C3: member ve el listado de su tenant (select amplio) ===
reset role;
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000ccc2", "role": "authenticated"}';

select is(
  (select count(*)::int from public.suppliers
   where tenant_id = '10000000-0000-0000-0000-00000000ccc1'),
  4, 'C3: member ve el listado de proveedores de su tenant');

-- === C3: member NO puede crear proveedor (RLS rechaza, INSERT viola WITH CHECK) ===
select throws_ok(
  $$insert into public.suppliers (tenant_id, name)
    values ('10000000-0000-0000-0000-00000000ccc1', 'no-deberia-crear')$$,
  '42501', null,
  'C3: member no puede crear proveedor (RLS la rechaza)');

-- === C3: member NO puede archivar proveedor (UPDATE no matchea filas por USING, sin excepción) ===
update public.suppliers set active = false
  where id = '20000000-0000-0000-0000-00000000ccc1';

select is(
  (select active from public.suppliers where id = '20000000-0000-0000-0000-00000000ccc1'),
  true, 'C3: member no puede archivar proveedor (el valor no cambia)');

select * from finish();
rollback;
