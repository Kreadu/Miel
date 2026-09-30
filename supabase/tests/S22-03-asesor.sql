-- S22-03 — Asesor con IA: aislamiento por empresa y solo owner/admin.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000223a01', 'owner-a-s2203@test.local'),
  ('00000000-0000-0000-0000-000000223a02', 'member-a-s2203@test.local'),
  ('00000000-0000-0000-0000-000000223b01', 'owner-b-s2203@test.local');
insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-000000223a01', 'Tenant A S22-03'),
  ('10000000-0000-0000-0000-000000223b01', 'Tenant B S22-03');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000223a01', '10000000-0000-0000-0000-000000223a01', 'owner',
   '00000000-0000-0000-0000-000000223a01'),
  ('00000000-0000-0000-0000-000000223a02', '10000000-0000-0000-0000-000000223a01', 'member',
   '00000000-0000-0000-0000-000000223a01'),
  ('00000000-0000-0000-0000-000000223b01', '10000000-0000-0000-0000-000000223b01', 'owner',
   '00000000-0000-0000-0000-000000223b01');
insert into public.advisor_questions (tenant_id, asked_by, question, answer, range_from, range_to) values
  ('10000000-0000-0000-0000-000000223b01', '00000000-0000-0000-0000-000000223b01',
   '¿Cómo mejoro?', 'Respuesta B', '2026-04', '2026-09');

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000223a01", "role": "authenticated"}';

select lives_ok($$
  insert into public.advisor_questions (tenant_id, question, answer, range_from, range_to)
  values ('10000000-0000-0000-0000-000000223a01', '¿Cómo subo el margen?', 'Respuesta A', '2026-04', '2026-09')
$$, 'C1: el dueño guarda su pregunta');
select is((select count(*)::int from public.advisor_questions), 1, 'C2: A ve solo las de su empresa');
select throws_ok($$
  insert into public.advisor_questions (tenant_id, question, answer, range_from, range_to)
  values ('10000000-0000-0000-0000-000000223b01', 'intrusa', 'x', '2026-04', '2026-09')
$$, '42501', null, 'C2: A no escribe en la empresa B');

set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000223a02", "role": "authenticated"}';
select is((select count(*)::int from public.advisor_questions), 0, 'C3: un operativo no ve preguntas');
select throws_ok($$
  insert into public.advisor_questions (tenant_id, question, answer, range_from, range_to)
  values ('10000000-0000-0000-0000-000000223a01', '¿Puedo?', 'x', '2026-04', '2026-09')
$$, '42501', null, 'C3: un operativo no pregunta');

select * from finish();
rollback;
