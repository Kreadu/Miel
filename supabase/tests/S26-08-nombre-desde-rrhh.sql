-- S26-08 — El nombre que firma las órdenes sale de RRHH (workers.full_name del trabajador conectado
-- a la cuenta, por invitación o por el mismo correo); memberships.display_name es copia automática.
-- Ver specs/S26-08-nombre-desde-rrhh.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000026801', 'Duena@Test.local'),
  ('00000000-0000-0000-0000-000000026802', 'otro@test.local');
insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-000000026801', 'A'),
  ('10000000-0000-0000-0000-000000026802', 'B');
-- La dueña tiene un nombre viejo de "Mi perfil": ya no sirve para firmar.
insert into public.memberships (user_id, tenant_id, role, display_name, created_by) values
  ('00000000-0000-0000-0000-000000026801', '10000000-0000-0000-0000-000000026801', 'owner', 'Nombre viejo', '00000000-0000-0000-0000-000000026801'),
  ('00000000-0000-0000-0000-000000026802', '10000000-0000-0000-0000-000000026802', 'owner', null, '00000000-0000-0000-0000-000000026802');
insert into public.suppliers (id, tenant_id, name, created_by) values
  ('20000000-0000-0000-0000-000000026801', '10000000-0000-0000-0000-000000026801', 'P', '00000000-0000-0000-0000-000000026801');
insert into public.products (id, tenant_id, sku, name, created_by) values
  ('30000000-0000-0000-0000-000000026801', '10000000-0000-0000-0000-000000026801', 'A', 'A', '00000000-0000-0000-0000-000000026801');

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000026801", "role": "authenticated"}';

-- C1: sin trabajador en RRHH no firma
select throws_ok(
  $$select public.create_purchase('20000000-0000-0000-0000-000000026801', 'ordered',
      '[{"product_id": "30000000-0000-0000-0000-000000026801", "qty": 1, "unit_cost": 10}]'::jsonb, null)$$,
  'P0001', 'display_name_required', 'C1: sin trabajador en RRHH no se firma (el nombre viejo no sirve)');

-- C4: un trabajador con ese correo en OTRA empresa no se conecta aquí
reset role;
insert into public.workers (id, tenant_id, full_name, doc_number, email, created_by) values
  ('40000000-0000-0000-0000-000000026802', '10000000-0000-0000-0000-000000026802', 'Homónima B', '9', 'duena@test.local', '00000000-0000-0000-0000-000000026802');
select ok((select user_id is null from public.workers where id = '40000000-0000-0000-0000-000000026802'),
  'C4: no se conecta una cuenta que no es de esa empresa');

-- C2: la dueña se crea en RRHH con su correo (otras mayúsculas)
insert into public.workers (id, tenant_id, full_name, doc_number, email, created_by) values
  ('40000000-0000-0000-0000-000000026801', '10000000-0000-0000-0000-000000026801', 'Dueña Real', '1', 'duena@TEST.local', '00000000-0000-0000-0000-000000026801');
select is((select user_id from public.workers where id = '40000000-0000-0000-0000-000000026801'),
  '00000000-0000-0000-0000-000000026801'::uuid, 'C2: queda conectado a su cuenta por el correo');
select is((select display_name from public.memberships where user_id = '00000000-0000-0000-0000-000000026801'),
  'Dueña Real', 'C2: la membresía muestra el nombre de RRHH');

set local role authenticated;
create temp table t_p on commit drop as
  select public.create_purchase('20000000-0000-0000-0000-000000026801', 'ordered',
    '[{"product_id": "30000000-0000-0000-0000-000000026801", "qty": 1, "unit_cost": 10}]'::jsonb, null) as id;
select is((select requested_by_name from public.purchases where id = (select id from t_p)),
  'Dueña Real', 'C2: la orden se firma con el nombre de RRHH');

-- C3: corregir el nombre en RRHH
update public.workers set full_name = 'Dueña Corregida' where id = '40000000-0000-0000-0000-000000026801';
reset role;
select is((select display_name from public.memberships where user_id = '00000000-0000-0000-0000-000000026801'),
  'Dueña Corregida', 'C3: la membresía se actualiza');
select is((select requested_by_name from public.purchases where id = (select id from t_p)),
  'Dueña Real', 'C3: la orden ya firmada conserva su nombre');

-- N4: ya no existe "Mi perfil"
select hasnt_function('public', 'set_my_display_name', 'N4: se borró set_my_display_name');

-- Trabajador inactivo: no firma
update public.workers set active = false where id = '40000000-0000-0000-0000-000000026801';
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000026801", "role": "authenticated"}';
select throws_ok(
  $$select public.create_purchase('20000000-0000-0000-0000-000000026801', 'ordered',
      '[{"product_id": "30000000-0000-0000-0000-000000026801", "qty": 1, "unit_cost": 10}]'::jsonb, null)$$,
  'P0001', 'display_name_required', 'N1: un trabajador inactivo no firma');

select * from finish();
rollback;
