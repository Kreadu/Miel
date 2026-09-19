-- S5-04 — Pagos de clientes: register_customer_payment + vista customer_balances.
-- Ver specs/S5-04-pagos-clientes.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- Fixtures: tenant A (owner + member) y tenant B (owner), clientes, ventas
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a001', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000a002', 'member-a@test.local'),
  ('00000000-0000-0000-0000-00000000b001', 'owner-b@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-00000000a001', 'Tenant A'),
  ('10000000-0000-0000-0000-00000000b001', 'Tenant B');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-00000000a001', '10000000-0000-0000-0000-00000000a001', 'owner',
   '00000000-0000-0000-0000-00000000a001'),
  ('00000000-0000-0000-0000-00000000a002', '10000000-0000-0000-0000-00000000a001', 'member',
   '00000000-0000-0000-0000-00000000a001'),
  ('00000000-0000-0000-0000-00000000b001', '10000000-0000-0000-0000-00000000b001', 'owner',
   '00000000-0000-0000-0000-00000000b001');

insert into public.customers (id, tenant_id, name, created_by) values
  ('20000000-0000-0000-0000-00000000a001', '10000000-0000-0000-0000-00000000a001',
   'Cliente A1', '00000000-0000-0000-0000-00000000a001'),
  ('20000000-0000-0000-0000-00000000a002', '10000000-0000-0000-0000-00000000a001',
   'Cliente A2', '00000000-0000-0000-0000-00000000a001'),
  ('20000000-0000-0000-0000-00000000b001', '10000000-0000-0000-0000-00000000b001',
   'Cliente B1', '00000000-0000-0000-0000-00000000b001');

-- Venta confirmed (cobrable, total 100), draft y cancelled (no cobrables) del Cliente A1
insert into public.sales (id, tenant_id, customer_id, status, subtotal, tax, total, created_by) values
  ('50000000-0000-0000-0000-00000000a001', '10000000-0000-0000-0000-00000000a001',
   '20000000-0000-0000-0000-00000000a001', 'confirmed', 100, 0, 100, '00000000-0000-0000-0000-00000000a001'),
  ('50000000-0000-0000-0000-00000000a002', '10000000-0000-0000-0000-00000000a001',
   '20000000-0000-0000-0000-00000000a001', 'draft', 50, 0, 50, '00000000-0000-0000-0000-00000000a001'),
  ('50000000-0000-0000-0000-00000000a003', '10000000-0000-0000-0000-00000000a001',
   '20000000-0000-0000-0000-00000000a001', 'cancelled', 50, 0, 50, '00000000-0000-0000-0000-00000000a001');

-- === Simular member A (regla clave: member SÍ puede registrar cobros) ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000a002", "role": "authenticated"}';

-- === C1: Cobro asociado a una venta, monto válido (member) ===
select lives_ok(
  $$select public.register_customer_payment(
      '20000000-0000-0000-0000-00000000a001'::uuid,
      '50000000-0000-0000-0000-00000000a001'::uuid,
      40.00::numeric,
      'transfer',
      now(),
      'Abono 1'
  )$$,
  'C1: member puede registrar cobro parcial válido a una venta');

select is(
  (select sum(amount) from public.customer_payments where sale_id = '50000000-0000-0000-0000-00000000a001'),
  40.00::numeric, 'C1: se guardó el abono de 40');

-- === C2: Cobro que excede saldo (100 - 40 = 60 restantes) ===
select throws_ok(
  $$select public.register_customer_payment(
      '20000000-0000-0000-0000-00000000a001'::uuid,
      '50000000-0000-0000-0000-00000000a001'::uuid,
      61.00::numeric,
      'transfer',
      now(),
      'Abono excedente'
  )$$,
  'P0001', 'payment_exceeds_balance', 'C2: rechaza si el cobro excede el saldo pendiente (61 > 60 restantes)');

-- === Completar cobro ===
select lives_ok(
  $$select public.register_customer_payment(
      '20000000-0000-0000-0000-00000000a001'::uuid,
      '50000000-0000-0000-0000-00000000a001'::uuid,
      60.00::numeric,
      'transfer',
      now(),
      'Abono final'
  )$$,
  'C1: member puede saldar la cuenta (60 exactos)');

-- === C3: Cobro sin asociar (abono general/anticipo) ===
select lives_ok(
  $$select public.register_customer_payment(
      '20000000-0000-0000-0000-00000000a001'::uuid,
      null,
      25.00::numeric,
      'cash',
      now(),
      'Anticipo'
  )$$,
  'C3: member puede registrar cobro sin venta (anticipo)');

-- === Rechazo por monto <= 0 ===
select throws_ok(
  $$select public.register_customer_payment(
      '20000000-0000-0000-0000-00000000a001'::uuid,
      null,
      0::numeric,
      'cash',
      now(),
      null
  )$$,
  'P0001', 'payment_amount_invalid', 'Rechaza monto 0 o negativo');

-- === C4: Venta no pertenece al cliente indicado ===
select throws_ok(
  $$select public.register_customer_payment(
      '20000000-0000-0000-0000-00000000a002'::uuid,
      '50000000-0000-0000-0000-00000000a001'::uuid,
      10::numeric,
      'cash',
      now(),
      null
  )$$,
  'P0001', 'sale_customer_mismatch', 'C4: rechaza si se intenta cobrar una venta con el cliente incorrecto');

-- === C5: Venta draft no es cobrable ===
select throws_ok(
  $$select public.register_customer_payment(
      '20000000-0000-0000-0000-00000000a001'::uuid,
      '50000000-0000-0000-0000-00000000a002'::uuid,
      10::numeric,
      'cash',
      now(),
      null
  )$$,
  'P0001', 'sale_not_receivable', 'C5: rechaza cobro a una venta draft');

-- === C5: Venta cancelada no es cobrable ===
select throws_ok(
  $$select public.register_customer_payment(
      '20000000-0000-0000-0000-00000000a001'::uuid,
      '50000000-0000-0000-0000-00000000a003'::uuid,
      10::numeric,
      'cash',
      now(),
      null
  )$$,
  'P0001', 'sale_not_receivable', 'C5: rechaza cobro a una venta cancelled');

-- === Simular owner B ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000b001", "role": "authenticated"}';

-- === C6: Cliente ajeno ===
select throws_ok(
  $$select public.register_customer_payment(
      '20000000-0000-0000-0000-00000000a001'::uuid,
      null,
      10::numeric,
      'cash',
      now(),
      null
  )$$,
  'P0001', 'customer_not_found', 'C6: owner B no puede cobrar a cliente del tenant A');

-- === Vista customer_balances: aislamiento (owner B no ve clientes del tenant A) ===
select is(
  (select count(*)::int from public.customer_balances
   where customer_id = '20000000-0000-0000-0000-00000000a001'),
  0, 'C9: owner B no ve el saldo del cliente A1 (aislamiento)');

-- === Simular owner A: ve la vista con el cálculo correcto ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000a001", "role": "authenticated"}';

select is(
  (select total_sales from public.customer_balances where customer_id = '20000000-0000-0000-0000-00000000a001'),
  100.00::numeric, 'C7: total_sales solo cuenta la venta confirmed (100), no draft ni cancelled');

select is(
  (select total_paid from public.customer_balances where customer_id = '20000000-0000-0000-0000-00000000a001'),
  125.00::numeric, 'C7: total_paid suma los 3 cobros (40+60+25)');

select is(
  (select balance from public.customer_balances where customer_id = '20000000-0000-0000-0000-00000000a001'),
  -25.00::numeric, 'C7: balance = 100 - 125 (saldo a favor del cliente por el anticipo)');

-- === Simular member A: vista vacía (regla de rol, no solo de tenant) ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000a002", "role": "authenticated"}';

select is(
  (select count(*)::int from public.customer_balances),
  0, 'C8: member no ve ninguna fila de customer_balances (restricción de rol)');

-- === RLS y escritura directa bloqueada ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000a001", "role": "authenticated"}';

select is(
  (select count(*)::int from public.customer_payments),
  3, 'Aislamiento: Owner A ve solo sus 3 pagos');

select throws_ok(
  $$insert into public.customer_payments (tenant_id, customer_id, amount, method)
    values ('10000000-0000-0000-0000-00000000a001', '20000000-0000-0000-0000-00000000a001', 10, 'cash')$$,
  '42501', null, 'Ningún rol puede insertar directamente en customer_payments (RLS lo prohíbe)');

select * from finish();
rollback;
