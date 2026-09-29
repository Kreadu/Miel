-- S19-18 — Bodega o sucursal "Principal" por empresa + datos de ubicación y contacto.
-- Ver specs/S19-18-bodega-principal.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000019a18', 'owner-a-s1918@test.local'),
  ('00000000-0000-0000-0000-000000019b18', 'owner-b-s1918@test.local');

-- === C1: una empresa nueva nace con su bodega "Principal" ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000019a18", "role": "authenticated"}';

select public.create_tenant_with_owner('Empresa A S19-18');

select is(
  (select count(*)::int from public.warehouses where is_default),
  1, 'C1: la empresa nueva tiene exactamente una bodega principal');

select is(
  (select name from public.warehouses where is_default),
  'Principal', 'C1: se llama "Principal"');

-- === C2: renombrable y con datos de ubicación/contacto ===
update public.warehouses
  set name = 'Casa matriz', address = 'Cra 1 # 2-3', department = 'Antioquia',
      city = 'Medellín', country = 'Colombia', postal_code = '050001',
      phone = '6041234567', whatsapp = '3001234567'
  where is_default;

select is(
  (select name || '|' || city || '|' || whatsapp from public.warehouses where is_default),
  'Casa matriz|Medellín|3001234567', 'C2: owner renombra y completa datos de la principal');

-- === C3: la principal no se puede archivar ===
select throws_ok(
  $$update public.warehouses set active = false where is_default$$,
  '23514', null, 'C3: archivar la principal viola el check');

-- === C4: is_default no es escribible desde la app ===
select throws_ok(
  $$update public.warehouses set is_default = false where is_default$$,
  '42501', null, 'C4: no se puede quitar la marca de principal');

select throws_ok(
  $$insert into public.warehouses (tenant_id, name, is_default)
    select tenant_id, 'Otra principal', true from public.warehouses where is_default$$,
  '42501', null, 'C4: no se puede crear otra principal');

-- Bodegas comunes siguen funcionando y se pueden archivar.
insert into public.warehouses (tenant_id, name, city)
  select tenant_id, 'Sucursal Centro', 'Bogotá' from public.warehouses where is_default;
update public.warehouses set active = false where name = 'Sucursal Centro';

select is(
  (select active from public.warehouses where name = 'Sucursal Centro'),
  false, 'C4: una bodega común se crea con datos y se archiva normal');

-- === C5: aislamiento — B no ve la principal de A ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000019b18", "role": "authenticated"}';

select public.create_tenant_with_owner('Empresa B S19-18');

select is(
  (select count(*)::int from public.warehouses where is_default),
  1, 'C5: B ve solo su propia principal');

select is(
  (select count(*)::int from public.warehouses where name = 'Casa matriz'),
  0, 'C5: B no ve la principal de A');

select * from finish();
rollback;
