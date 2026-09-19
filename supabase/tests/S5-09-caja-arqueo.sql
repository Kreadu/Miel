-- S5-09 — Apertura/cierre de caja con arqueo (cash_sessions, open_cash_session,
-- close_cash_session, aislamiento por rol). Ver specs/S5-09-caja-arqueo.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- Fixtures: tenant A (owner + 2 members) y tenant B (owner), cliente para el fixture de cobros.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000d001', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000d002', 'member-a@test.local'),
  ('00000000-0000-0000-0000-00000000d003', 'member2-a@test.local'),
  ('00000000-0000-0000-0000-00000000d004', 'owner-b@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-00000000d001', 'Tenant A'),
  ('10000000-0000-0000-0000-00000000d002', 'Tenant B');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-00000000d001', '10000000-0000-0000-0000-00000000d001', 'owner',
   '00000000-0000-0000-0000-00000000d001'),
  ('00000000-0000-0000-0000-00000000d002', '10000000-0000-0000-0000-00000000d001', 'member',
   '00000000-0000-0000-0000-00000000d001'),
  ('00000000-0000-0000-0000-00000000d003', '10000000-0000-0000-0000-00000000d001', 'member',
   '00000000-0000-0000-0000-00000000d001'),
  ('00000000-0000-0000-0000-00000000d004', '10000000-0000-0000-0000-00000000d002', 'owner',
   '00000000-0000-0000-0000-00000000d004');

insert into public.customers (id, tenant_id, name, created_by) values
  ('50000000-0000-0000-0000-00000000d001', '10000000-0000-0000-0000-00000000d001', 'Cliente D1',
   '00000000-0000-0000-0000-00000000d001');

-- === Simular a member_a (tenant A) ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000d002", "role": "authenticated"}';

-- === C1: open_cash_session crea sesión abierta con los datos correctos ===
select lives_ok(
  $$select public.open_cash_session(500, '10000000-0000-0000-0000-00000000d001')$$,
  'C1: member_a abre su sesión de caja');

select is(
  (select status from public.cash_sessions where opened_by = '00000000-0000-0000-0000-00000000d002'),
  'open', 'C1: la sesión queda open');

select is(
  (select opening_amount from public.cash_sessions where opened_by = '00000000-0000-0000-0000-00000000d002'),
  500.00::numeric, 'C1: opening_amount persistido');

-- === C2: segunda apertura del mismo usuario falla, no duplica fila ===
select throws_ok(
  $$select public.open_cash_session(300, '10000000-0000-0000-0000-00000000d001')$$,
  'P0001', 'cash_session_already_open', 'C2: no se puede abrir dos sesiones');

select is(
  (select count(*)::int from public.cash_sessions where opened_by = '00000000-0000-0000-0000-00000000d002'),
  1, 'C2: sigue existiendo una sola sesión de member_a');

-- === C3: close_cash_session calcula expected_amount y difference con cobros en efectivo ===
-- Fixture: un cobro en efectivo de 150 ligado a la sesión abierta de member_a.
reset role;
insert into public.customer_payments (
  tenant_id, customer_id, amount, method, cash_session_id, created_by
) values (
  '10000000-0000-0000-0000-00000000d001', '50000000-0000-0000-0000-00000000d001', 150, 'cash',
  (select id from public.cash_sessions where opened_by = '00000000-0000-0000-0000-00000000d002'),
  '00000000-0000-0000-0000-00000000d002'
);
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000d002", "role": "authenticated"}';

select lives_ok(
  $$select public.close_cash_session(600)$$,
  'C3: member_a cierra su sesión');

select is(
  (select expected_amount from public.cash_sessions where opened_by = '00000000-0000-0000-0000-00000000d002'),
  650.00::numeric, 'C3: expected_amount = opening (500) + cobros efectivo (150)');

select is(
  (select difference from public.cash_sessions where opened_by = '00000000-0000-0000-0000-00000000d002'),
  -50.00::numeric, 'C3: difference = contado (600) - esperado (650)');

select is(
  (select status from public.cash_sessions where opened_by = '00000000-0000-0000-0000-00000000d002'),
  'closed', 'C3: status pasa a closed');

-- === C4: cerrar una sesión ya cerrada falla y no la modifica ===
select throws_ok(
  $$select public.close_cash_session(700)$$,
  'P0001', 'cash_session_not_open', 'C4: no se puede cerrar dos veces');

select is(
  (select counted_amount from public.cash_sessions where opened_by = '00000000-0000-0000-0000-00000000d002'),
  600.00::numeric, 'C4: counted_amount no cambió tras el intento fallido');

-- === C5: member no cierra sesión ajena; owner/admin sí ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000d003", "role": "authenticated"}';

select lives_ok(
  $$select public.open_cash_session(1000, '10000000-0000-0000-0000-00000000d001')$$,
  'C5: member2_a abre su propia sesión');

-- Capturar el id en una tabla temporal (sin RLS) mientras aún se ve bajo su propio rol:
-- member_a no puede ver la fila de member2_a para resolver el id después de cambiar de claims.
create temporary table t_m2_session as
select id from public.cash_sessions where opened_by = '00000000-0000-0000-0000-00000000d003';

set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000d002", "role": "authenticated"}';

select throws_ok(
  format(
    $$select public.close_cash_session(999, %L::uuid)$$,
    (select id from t_m2_session)
  ),
  'P0001', 'permission_denied', 'C5: member_a no puede cerrar la sesión de member2_a');

set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000d001", "role": "authenticated"}';

select lives_ok(
  format(
    $$select public.close_cash_session(999, %L::uuid)$$,
    (select id from t_m2_session)
  ),
  'C5: owner_a sí puede cerrar la sesión de member2_a');

select is(
  (select status from public.cash_sessions where opened_by = '00000000-0000-0000-0000-00000000d003'),
  'closed', 'C5: la sesión de member2_a queda closed por el owner');

-- === Aislamiento por rol y por tenant ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000d002", "role": "authenticated"}';

select is(
  (select count(*)::int from public.cash_sessions
   where tenant_id = '10000000-0000-0000-0000-00000000d001'
     and opened_by <> '00000000-0000-0000-0000-00000000d002'),
  0, 'C6: member_a no ve sesiones de otros usuarios del tenant');

set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000d001", "role": "authenticated"}';

select is(
  (select count(*)::int from public.cash_sessions where tenant_id = '10000000-0000-0000-0000-00000000d001'),
  2, 'C6: owner_a ve todas las sesiones del tenant (member_a + member2_a)');

set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000d004", "role": "authenticated"}';

select is(
  (select count(*)::int from public.cash_sessions where tenant_id = '10000000-0000-0000-0000-00000000d001'),
  0, 'C6: owner_b no ve sesiones del tenant A');

select * from finish();
rollback;
