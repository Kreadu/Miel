-- S1-05 — Invitaciones con rol: tabla invitations (RLS) + RPC accept_invitation.
-- Ver specs/S1-05-invitaciones-roles.md, docs/DECISIONS.md ADR-018 (security definer:
-- el invitado aun no es miembro del tenant).
--
-- Nota: el invitado NO tiene permiso de select sobre invitations (RLS es solo owner/admin,
-- por diseño — ver spec). Los tokens se capturan como `postgres` (bypassa RLS por ser owner
-- de la tabla) con \gset ANTES de simular al invitado, igual que hara la RPC del lado
-- servidor (que sí puede leer el token porque es security definer).
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Fixtures: tenant A (owner + member) y tenant B (owner), mas 2 usuarios invitados sin cuenta
-- creada aun (se registran mas adelante en el flujo, aqui solo se prueba la RPC).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000aaa1', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000aaa2', 'member-a@test.local'),
  ('00000000-0000-0000-0000-00000000bbb1', 'owner-b@test.local'),
  ('00000000-0000-0000-0000-00000000dd11', 'invitado@test.local'),
  ('00000000-0000-0000-0000-00000000ee22', 'otro@test.local');

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

-- === C1: owner crea invitacion (RLS permite) ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000aaa1", "role": "authenticated"}';

insert into public.invitations (tenant_id, email, role) values
  ('10000000-0000-0000-0000-00000000aaa1', 'invitado@test.local', 'admin');

select is(
  (select count(*)::int from public.invitations
   where tenant_id = '10000000-0000-0000-0000-00000000aaa1'),
  1, 'C1: owner crea invitacion en su tenant');

-- === Aislamiento: A no ve invitations de B ===
insert into public.invitations (tenant_id, email, role) values
  ('10000000-0000-0000-0000-00000000aaa1', 'otro@test.local', 'member');

reset role;
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000bbb1", "role": "authenticated"}';
insert into public.invitations (tenant_id, email, role) values
  ('10000000-0000-0000-0000-00000000bbb1', 'ajena@test.local', 'member');

select is(
  (select count(*)::int from public.invitations
   where tenant_id = '10000000-0000-0000-0000-00000000aaa1'),
  0, 'Aislamiento: B no ve invitations del tenant A');

-- === C1: member NO puede crear invitacion (RLS rechaza) ===
reset role;
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000aaa2", "role": "authenticated"}';

select throws_ok(
  $$insert into public.invitations (tenant_id, email, role)
    values ('10000000-0000-0000-0000-00000000aaa1', 'nueva@test.local', 'member')$$,
  '42501', null,
  'C1: member no puede crear invitacion (RLS la rechaza)');

-- === C2: caso feliz — invitado acepta con su propio email ===
reset role;
select token as invite_token_c2 from public.invitations
  where tenant_id = '10000000-0000-0000-0000-00000000aaa1' and email = 'invitado@test.local' \gset

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000dd11", "role": "authenticated", "email": "invitado@test.local"}';

select isnt(
  (select public.accept_invitation(:'invite_token_c2'::uuid)),
  null,
  'C2: accept_invitation retorna el tenant_id');

select is(
  (select count(*)::int from public.memberships
   where user_id = '00000000-0000-0000-0000-00000000dd11'
     and tenant_id = '10000000-0000-0000-0000-00000000aaa1'
     and role = 'admin'),
  1, 'C2: membership creada con el rol invitado');

reset role;
select is(
  (select accepted_at is not null from public.invitations where token = :'invite_token_c2'::uuid),
  true, 'C2: invitacion queda accepted_at');

-- === C3: token ya aceptado no se puede volver a aceptar ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000dd11", "role": "authenticated", "email": "invitado@test.local"}';

select throws_ok(
  format('select public.accept_invitation(%L::uuid)', :'invite_token_c2'),
  'P0001', null,
  'C3: token ya aceptado es rechazado');

-- === C3: token vencido rechazado ===
-- Email dedicado ('vencida@…', no 'otro@…'): dentro de esta transaccion now() es constante,
-- asi que dos invitaciones con el mismo email comparten created_at y "order by ... limit 1"
-- seria ambiguo.
reset role;
set local role postgres;
insert into public.invitations (tenant_id, email, role, expires_at, created_by) values
  ('10000000-0000-0000-0000-00000000aaa1', 'vencida@test.local', 'member', now() - interval '1 day',
   '00000000-0000-0000-0000-00000000aaa1');

select token as invite_token_expired from public.invitations
  where tenant_id = '10000000-0000-0000-0000-00000000aaa1' and email = 'vencida@test.local' \gset

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000ee22", "role": "authenticated", "email": "vencida@test.local"}';

select throws_ok(
  format('select public.accept_invitation(%L::uuid)', :'invite_token_expired'),
  'P0001', null,
  'C3: token vencido es rechazado');

-- === C4: email del JWT distinto al invitado ===
reset role;
set local role postgres;
insert into public.invitations (tenant_id, email, role, created_by) values
  ('10000000-0000-0000-0000-00000000aaa1', 'nueva@test.local', 'member',
   '00000000-0000-0000-0000-00000000aaa1');

select token as invite_token_ajena from public.invitations
  where tenant_id = '10000000-0000-0000-0000-00000000aaa1' and email = 'nueva@test.local' \gset

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000ee22", "role": "authenticated", "email": "otro@test.local"}';

select throws_ok(
  format('select public.accept_invitation(%L::uuid)', :'invite_token_ajena'),
  'P0001', null,
  'C4: token no transferible — email del JWT distinto al invitado es rechazado');

-- === C5: invitado que ya es miembro del tenant no puede duplicar membership ===
reset role;
set local role postgres;
insert into public.invitations (tenant_id, email, role, created_by) values
  ('10000000-0000-0000-0000-00000000aaa1', 'invitado@test.local', 'member',
   '00000000-0000-0000-0000-00000000aaa1');

select token as invite_token_dup from public.invitations
  where tenant_id = '10000000-0000-0000-0000-00000000aaa1' and email = 'invitado@test.local'
  and accepted_at is null \gset

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000dd11", "role": "authenticated", "email": "invitado@test.local"}';

select throws_ok(
  format('select public.accept_invitation(%L::uuid)', :'invite_token_dup'),
  'P0001', null,
  'C5: invitado que ya es miembro no duplica membership');

-- === Atomicidad: ninguna llamada fallida dejo membership huerfana ===
reset role;
select is(
  (select count(*)::int from public.memberships
   where user_id = '00000000-0000-0000-0000-00000000ee22'),
  0, 'Atomicidad: los intentos rechazados no crearon membership');

-- === anonimo rechazado ===
set local role anon;
set local "request.jwt.claims" to '{"role": "anon"}';
select throws_ok(
  $$select public.accept_invitation('00000000-0000-0000-0000-000000000000'::uuid)$$,
  'P0001', null,
  'Usuario anonimo es rechazado por accept_invitation');

select throws_ok(
  $$insert into public.invitations (tenant_id, email, role)
    values ('10000000-0000-0000-0000-00000000aaa1', 'x@test.local', 'member')$$,
  '42501', null,
  'Usuario anonimo no puede insertar invitations');

select * from finish();
rollback;
