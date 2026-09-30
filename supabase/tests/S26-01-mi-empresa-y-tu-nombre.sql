-- S26-01 — Datos de la empresa (solo admin), "Tu nombre" (cada uno el suyo) y bucket de logos.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000026101', 'owner-s2601@test.local'),
  ('00000000-0000-0000-0000-000000026102', 'member-s2601@test.local'),
  ('00000000-0000-0000-0000-000000026103', 'ajeno-s2601@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-000000026101', 'Tenant S26-01'),
  ('10000000-0000-0000-0000-000000026102', 'Tenant ajeno S26-01');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000026101', '10000000-0000-0000-0000-000000026101', 'owner',
   '00000000-0000-0000-0000-000000026101'),
  ('00000000-0000-0000-0000-000000026102', '10000000-0000-0000-0000-000000026101', 'member',
   '00000000-0000-0000-0000-000000026101'),
  ('00000000-0000-0000-0000-000000026103', '10000000-0000-0000-0000-000000026102', 'owner',
   '00000000-0000-0000-0000-000000026103');

-- === Operativo: pone su nombre, no el de otro ni los datos de la empresa ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000026102", "role": "authenticated"}';

select lives_ok(
  $$select public.set_my_display_name('10000000-0000-0000-0000-000000026101', '  Ana Pérez  ')$$,
  'cada usuario pone su nombre');
select is(
  (select display_name from public.memberships
   where user_id = '00000000-0000-0000-0000-000000026102' and tenant_id = '10000000-0000-0000-0000-000000026101'),
  'Ana Pérez', 'queda guardado sin espacios de más');
select is(
  (select display_name from public.memberships
   where user_id = '00000000-0000-0000-0000-000000026101' and tenant_id = '10000000-0000-0000-0000-000000026101'),
  null, 'no toca el nombre de otro');
select throws_ok(
  $$select public.set_my_display_name('10000000-0000-0000-0000-000000026101', '   ')$$,
  'P0001', 'display_name_invalid', 'nombre vacío no');
select throws_ok(
  $$select public.set_my_display_name('10000000-0000-0000-0000-000000026101', repeat('a', 81))$$,
  'P0001', 'display_name_invalid', 'más de 80 caracteres no');
select throws_ok(
  $$select public.set_my_display_name('10000000-0000-0000-0000-000000026102', 'Ana')$$,
  'P0001', 'permission_denied', 'en otra empresa no');

update public.tenants set phone = '123' where id = '10000000-0000-0000-0000-000000026101';
select is((select phone from public.tenants where id = '10000000-0000-0000-0000-000000026101'), null,
  'un operativo no cambia los datos de la empresa');

-- === Dueño: cambia los datos de su empresa ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000026101", "role": "authenticated"}';
update public.tenants set address = 'Calle 1', phone = '555', email = 'hola@empresa.co',
  logo_url = 'https://x/logo.png' where id = '10000000-0000-0000-0000-000000026101';
select results_eq(
  $$select address, phone, email from public.tenants where id = '10000000-0000-0000-0000-000000026101'$$,
  $$values ('Calle 1'::text, '555'::text, 'hola@empresa.co'::text)$$,
  'el dueño guarda los datos de la empresa');

-- === Bucket de logos: escribe solo el admin, en la carpeta de su empresa ===
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner)
    values ('company-logos', '10000000-0000-0000-0000-000000026101/logo.png', '00000000-0000-0000-0000-000000026101')$$,
  'el dueño sube el logo de su empresa');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner)
    values ('company-logos', '10000000-0000-0000-0000-000000026102/logo.png', '00000000-0000-0000-0000-000000026101')$$,
  '42501', null, 'no en la carpeta de otra empresa');

select * from finish();
rollback;
