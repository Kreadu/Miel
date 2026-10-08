-- S26-12 — link_worker_to_me: conectar mi ficha de RRHH con mi cuenta (sin invitarme a mí mismo).
-- Ver specs/S26-12-conectar-mi-ficha.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000026c01', 'Duena@S2612.local'),
  ('00000000-0000-0000-0000-000000026c02', 'otra@s2612.local'),
  ('00000000-0000-0000-0000-000000026c03', 'miembro@s2612.local');
insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-000000026c01', 'A'),
  ('10000000-0000-0000-0000-000000026c02', 'B');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000026c01', '10000000-0000-0000-0000-000000026c01', 'owner', '00000000-0000-0000-0000-000000026c01'),
  ('00000000-0000-0000-0000-000000026c02', '10000000-0000-0000-0000-000000026c01', 'admin', '00000000-0000-0000-0000-000000026c01'),
  ('00000000-0000-0000-0000-000000026c03', '10000000-0000-0000-0000-000000026c01', 'member', '00000000-0000-0000-0000-000000026c01');
insert into public.workers (id, tenant_id, full_name, doc_number, created_by) values
  ('40000000-0000-0000-0000-000000026c01', '10000000-0000-0000-0000-000000026c01', 'Dueña Real', '1', '00000000-0000-0000-0000-000000026c01'),
  ('40000000-0000-0000-0000-000000026c02', '10000000-0000-0000-0000-000000026c01', 'Otra ficha', '2', '00000000-0000-0000-0000-000000026c01'),
  ('40000000-0000-0000-0000-000000026c03', '10000000-0000-0000-0000-000000026c02', 'Ajena', '3', '00000000-0000-0000-0000-000000026c01');
insert into public.invitations (tenant_id, email, role, created_by) values
  ('10000000-0000-0000-0000-000000026c01', 'duena@s2612.local', 'admin', '00000000-0000-0000-0000-000000026c01');

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000026c01", "role": "authenticated"}';

select lives_ok($$select public.link_worker_to_me('40000000-0000-0000-0000-000000026c01')$$, 'C1: la dueña conecta su ficha');
reset role;
select results_eq(
  $$select user_id, email from public.workers where id = '40000000-0000-0000-0000-000000026c01'$$,
  $$values ('00000000-0000-0000-0000-000000026c01'::uuid, 'Duena@S2612.local'::text)$$,
  'C1: conectada, con el correo de la cuenta');
select is((select display_name from public.memberships where user_id = '00000000-0000-0000-0000-000000026c01'),
  'Dueña Real', 'C1: la membresía toma el nombre de RRHH');
select is((select count(*)::int from public.invitations where lower(email) = 'duena@s2612.local'),
  0, 'C1: se borran sus invitaciones pendientes');

set local role authenticated;
select throws_ok($$select public.link_worker_to_me('40000000-0000-0000-0000-000000026c02')$$,
  'P0001', 'account_already_linked', 'C2: una cuenta, una ficha por empresa');
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000026c02", "role": "authenticated"}';
select throws_ok($$select public.link_worker_to_me('40000000-0000-0000-0000-000000026c01')$$,
  'P0001', 'worker_linked', 'C2: una ficha ya conectada a otra cuenta');
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000026c03", "role": "authenticated"}';
select throws_ok($$select public.link_worker_to_me('40000000-0000-0000-0000-000000026c02')$$,
  'P0001', 'permission_denied', 'C2: un miembro no conecta fichas');

select * from finish();
rollback;
