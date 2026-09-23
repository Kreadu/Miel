-- S12-04 — open_cash_session recibe p_tenant_id explícito en vez de resolverlo con
-- `limit 1` sobre memberships. Ver specs/S12-04-caja-tenant-activo.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- Fixture: un usuario con membership en dos tenants (A y B) y un usuario ajeno solo en C.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000e001', 'multi@test.local'),
  ('00000000-0000-0000-0000-00000000e002', 'ajeno@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-00000000e001', 'Tenant E-A'),
  ('10000000-0000-0000-0000-00000000e002', 'Tenant E-B'),
  ('10000000-0000-0000-0000-00000000e003', 'Tenant E-C');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-00000000e001', '10000000-0000-0000-0000-00000000e001', 'owner',
   '00000000-0000-0000-0000-00000000e001'),
  ('00000000-0000-0000-0000-00000000e001', '10000000-0000-0000-0000-00000000e002', 'member',
   '00000000-0000-0000-0000-00000000e001'),
  ('00000000-0000-0000-0000-00000000e002', '10000000-0000-0000-0000-00000000e003', 'owner',
   '00000000-0000-0000-0000-00000000e002');

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000e001", "role": "authenticated"}';

-- === C1: abre en el tenant B explícito, no en A (que sería el "primero" por created_at) ===
select lives_ok(
  $$select public.open_cash_session(500, '10000000-0000-0000-0000-00000000e002')$$,
  'C1: abre caja en el tenant B explícito');

select is(
  (select tenant_id from public.cash_sessions where opened_by = '00000000-0000-0000-0000-00000000e001'),
  '10000000-0000-0000-0000-00000000e002'::uuid,
  'C1: la sesión queda en tenant B, no en A');

select is(
  (select count(*)::int from public.cash_sessions
   where opened_by = '00000000-0000-0000-0000-00000000e001' and tenant_id = '10000000-0000-0000-0000-00000000e001'),
  0, 'C1: no se creó (ni existe) sesión en tenant A');

-- === C2: p_tenant_id de un tenant ajeno (sin membership) falla, no crea fila ===
select throws_ok(
  $$select public.open_cash_session(500, '10000000-0000-0000-0000-00000000e003')$$,
  'P0001', 'permission_denied', 'C2: tenant ajeno sin membership → permission_denied');

select is(
  (select count(*)::int from public.cash_sessions where tenant_id = '10000000-0000-0000-0000-00000000e003'),
  0, 'C2: no se creó sesión en el tenant ajeno');

select * from finish();
rollback;
