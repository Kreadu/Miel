-- S21-03 — Código de 4 dígitos: solo admin lo asigna, se guarda como hash ilegible por la API,
-- se verifica dentro de la empresa, bloquea tras 5 fallos y devuelve los módulos de la categoría.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000213a01', 'owner-a-s2103@test.local'),
  ('00000000-0000-0000-0000-000000213a02', 'tienda-a-s2103@test.local'),
  ('00000000-0000-0000-0000-000000213b01', 'owner-b-s2103@test.local');
insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-000000213a01', 'Tenant A S21-03'),
  ('10000000-0000-0000-0000-000000213b01', 'Tenant B S21-03');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000213a01', '10000000-0000-0000-0000-000000213a01', 'owner',
   '00000000-0000-0000-0000-000000213a01'),
  ('00000000-0000-0000-0000-000000213a02', '10000000-0000-0000-0000-000000213a01', 'member',
   '00000000-0000-0000-0000-000000213a01'),
  ('00000000-0000-0000-0000-000000213b01', '10000000-0000-0000-0000-000000213b01', 'owner',
   '00000000-0000-0000-0000-000000213b01');
insert into public.worker_categories (id, tenant_id, name, modules, created_by) values
  ('30000000-0000-0000-0000-000000213a01', '10000000-0000-0000-0000-000000213a01', 'Vendedor',
   '{ventas}', '00000000-0000-0000-0000-000000213a01');
insert into public.workers (id, tenant_id, full_name, doc_number, category_id, created_by) values
  ('40000000-0000-0000-0000-000000213a01', '10000000-0000-0000-0000-000000213a01', 'Ana Pérez', '1',
   '30000000-0000-0000-0000-000000213a01', '00000000-0000-0000-0000-000000213a01');

set local role authenticated;

-- === C1: la cuenta de tienda (member) no asigna códigos; el dueño sí ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000213a02", "role": "authenticated"}';
select throws_ok(
  $$select public.set_worker_pin('40000000-0000-0000-0000-000000213a01', 'ana', '1234')$$,
  'P0001', 'permission_denied', 'C1: member no asigna código');

set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000213a01", "role": "authenticated"}';
select lives_ok(
  $$select public.set_worker_pin('40000000-0000-0000-0000-000000213a01', 'Ana', '1234')$$,
  'C1: owner asigna usuario y código');
select throws_ok(
  $$select public.set_worker_pin('40000000-0000-0000-0000-000000213a01', 'ana', '12a4')$$,
  'P0001', 'pin_invalid', 'C1: el código son 4 números');

-- === C2: el hash no se lee ni se escribe por la API ===
select throws_ok(
  $$select pin_hash from public.workers$$,
  '42501', null, 'C2: pin_hash no se puede leer');
select throws_ok(
  $$update public.workers set pin_hash = 'x' where id = '40000000-0000-0000-0000-000000213a01'$$,
  '42501', null, 'C2: pin_hash no se puede escribir');

-- === C3: la cuenta de tienda identifica a Ana y recibe sus módulos ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000213a02", "role": "authenticated"}';
select is(
  (select modules from public.verify_worker_pin('10000000-0000-0000-0000-000000213a01', 'ANA', '1234')),
  '{ventas}'::text[], 'C3: usuario sin distinguir mayúsculas + código correcto → módulos de Vendedor');

-- === C4: código incorrecto falla; 5 fallos bloquean ===
select is(
  (select count(*)::int from public.verify_worker_pin('10000000-0000-0000-0000-000000213a01', 'ana', '0000')),
  0, 'C4: código incorrecto → sin resultado (y el intento queda registrado)');

reset role;
insert into public.worker_login_attempts (tenant_id, username, success)
select '10000000-0000-0000-0000-000000213a01', 'ana', false from generate_series(1, 5);
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000213a02", "role": "authenticated"}';
select throws_ok(
  $$select * from public.verify_worker_pin('10000000-0000-0000-0000-000000213a01', 'ana', '1234')$$,
  'P0001', 'locked', 'C4: bloqueado tras 5 fallos, aunque el código sea correcto');

-- === C5: otra empresa no puede verificar códigos de A ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000213b01", "role": "authenticated"}';
select throws_ok(
  $$select * from public.verify_worker_pin('10000000-0000-0000-0000-000000213a01', 'ana', '1234')$$,
  'P0001', 'permission_denied', 'C5: otra empresa');
select is(
  (select count(*)::int from public.active_worker_modules('10000000-0000-0000-0000-000000213a01',
    '40000000-0000-0000-0000-000000213a01')),
  0, 'C5: otra empresa no lee los módulos del trabajador');

-- === C6: los intentos quedan registrados (visibles al dueño) ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000213a01", "role": "authenticated"}';
select ok((select count(*) from public.worker_login_attempts) >= 7, 'C6: intentos registrados');

select * from finish();
rollback;
