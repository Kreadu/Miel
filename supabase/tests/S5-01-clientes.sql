-- S5-01 — Gestión de clientes: tabla customers + RLS (select para todo el tenant, write solo
-- owner/admin) + documento único por tenant cuando está presente.
-- Ver specs/done/S5-01-clientes.md, docs/arch/multitenancy-rls.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- Fixtures: tenant A (owner + member) y tenant B (owner)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000cce1', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000cce2', 'member-a@test.local'),
  ('00000000-0000-0000-0000-00000000dde1', 'owner-b@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-00000000cce1', 'Tenant A'),
  ('10000000-0000-0000-0000-00000000dde1', 'Tenant B');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-00000000cce1', '10000000-0000-0000-0000-00000000cce1', 'owner',
   '00000000-0000-0000-0000-00000000cce1'),
  ('00000000-0000-0000-0000-00000000cce2', '10000000-0000-0000-0000-00000000cce1', 'member',
   '00000000-0000-0000-0000-00000000cce1'),
  ('00000000-0000-0000-0000-00000000dde1', '10000000-0000-0000-0000-00000000dde1', 'owner',
   '00000000-0000-0000-0000-00000000dde1');

insert into public.customers (id, tenant_id, name, doc_type, doc_number, created_by) values
  ('30000000-0000-0000-0000-00000000cce1', '10000000-0000-0000-0000-00000000cce1',
   'Cliente A', 'nit', '900111222', '00000000-0000-0000-0000-00000000cce1'),
  ('30000000-0000-0000-0000-00000000dde1', '10000000-0000-0000-0000-00000000dde1',
   'Cliente B', 'nit', '900333444', '00000000-0000-0000-0000-00000000dde1');

-- === C1: owner crea cliente en su tenant (RLS permite) ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000cce1", "role": "authenticated"}';

insert into public.customers (tenant_id, name) values
  ('10000000-0000-0000-0000-00000000cce1', 'Cliente sin doc nuevo');

select is(
  (select count(*)::int from public.customers
   where tenant_id = '10000000-0000-0000-0000-00000000cce1'),
  2, 'C1: owner crea cliente en su tenant');

-- === C1: documento duplicado (mismo tipo y numero) rechazado ===
select throws_ok(
  $$insert into public.customers (tenant_id, name, doc_type, doc_number)
    values ('10000000-0000-0000-0000-00000000cce1', 'Cliente duplicado', 'nit', '900111222')$$,
  '23505', null, 'C1: doc_type y doc_number duplicado en el mismo tenant es rechazado');

-- === C1: dos clientes sin doc_number (NULL) conviven sin conflicto ===
insert into public.customers (tenant_id, name) values
  ('10000000-0000-0000-0000-00000000cce1', 'Sin doc dos');

select is(
  (select count(*)::int from public.customers
   where tenant_id = '10000000-0000-0000-0000-00000000cce1' and doc_number is null),
  2, 'C1: clientes sin doc_number conviven sin conflicto');

-- === C3: aislamiento — A no ve clientes de B ===
select is(
  (select count(*)::int from public.customers
   where tenant_id = '10000000-0000-0000-0000-00000000dde1'),
  0, 'C3: A no ve clientes del tenant B');

-- === owner edita los datos de su cliente ===
update public.customers set name = 'Cliente A renombrado', email = 'contacto@cliente-a.test'
  where id = '30000000-0000-0000-0000-00000000cce1';

select is(
  (select name from public.customers where id = '30000000-0000-0000-0000-00000000cce1'),
  'Cliente A renombrado', 'owner edita el nombre de su cliente');

select has_trigger('public', 'customers', 'customers_set_updated_at',
  'trigger set_updated_at existe sobre customers');

-- === C2: owner archiva y reactiva su cliente (soft-delete, sin borrado físico) ===
update public.customers set active = false
  where id = '30000000-0000-0000-0000-00000000cce1';

select is(
  (select active from public.customers where id = '30000000-0000-0000-0000-00000000cce1'),
  false, 'C2: owner archiva su cliente (active=false)');

update public.customers set active = true
  where id = '30000000-0000-0000-0000-00000000cce1';

select is(
  (select active from public.customers where id = '30000000-0000-0000-0000-00000000cce1'),
  true, 'C2: owner reactiva su cliente (active=true)');

-- === C3: A no puede escribir en el tenant B ===
select throws_ok(
  $$insert into public.customers (tenant_id, name)
    values ('10000000-0000-0000-0000-00000000dde1', 'intruso')$$,
  '42501', null, 'C3: A no puede escribir en el tenant B');

-- === C4: member ve el listado de su tenant (select amplio) ===
reset role;
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000cce2", "role": "authenticated"}';

select is(
  (select count(*)::int from public.customers
   where tenant_id = '10000000-0000-0000-0000-00000000cce1'),
  3, 'C4: member ve el listado de clientes de su tenant');

-- === C4: member SÍ puede crear cliente (ADR-033/S15-02 supersede el punto de S5-01 que lo
-- prohibía; el resto de la matriz de member — no editar/archivar — se prueba en
-- S15-02-member-crea-cliente.sql) ===
insert into public.customers (tenant_id, name)
  values ('10000000-0000-0000-0000-00000000cce1', 'creado-por-member');

select is(
  (select count(*)::int from public.customers
   where tenant_id = '10000000-0000-0000-0000-00000000cce1' and name = 'creado-por-member'),
  1, 'C4: member sí puede crear cliente (ADR-033)');

-- === C4: member NO puede archivar cliente (UPDATE no matchea filas por USING, sin excepción) ===
update public.customers set active = false
  where id = '30000000-0000-0000-0000-00000000cce1';

select is(
  (select active from public.customers where id = '30000000-0000-0000-0000-00000000cce1'),
  true, 'C4: member no puede archivar cliente (el valor no cambia)');

select * from finish();
rollback;
