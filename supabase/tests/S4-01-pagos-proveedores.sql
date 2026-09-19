-- S4-01 — Pagos a proveedores
-- Ver specs/S4-01-pagos-proveedores.md
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Fixtures: tenant A (owner + member) y tenant B (owner), proveedor, compra
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

insert into public.suppliers (id, tenant_id, name, created_by) values
  ('20000000-0000-0000-0000-00000000a001', '10000000-0000-0000-0000-00000000a001',
   'Proveedor A1', '00000000-0000-0000-0000-00000000a001'),
  ('20000000-0000-0000-0000-00000000a002', '10000000-0000-0000-0000-00000000a001',
   'Proveedor A2', '00000000-0000-0000-0000-00000000a001'),
  ('20000000-0000-0000-0000-00000000b001', '10000000-0000-0000-0000-00000000b001',
   'Proveedor B1', '00000000-0000-0000-0000-00000000b001');

-- Orden con total 100 (received, pagable) + orden draft y orden cancelled (no pagables)
insert into public.purchases (id, tenant_id, supplier_id, status, subtotal, tax, total, created_by) values
  ('50000000-0000-0000-0000-00000000a001', '10000000-0000-0000-0000-00000000a001',
   '20000000-0000-0000-0000-00000000a001', 'received', 100, 0, 100, '00000000-0000-0000-0000-00000000a001'),
  ('50000000-0000-0000-0000-00000000a002', '10000000-0000-0000-0000-00000000a001',
   '20000000-0000-0000-0000-00000000a001', 'draft', 50, 0, 50, '00000000-0000-0000-0000-00000000a001'),
  ('50000000-0000-0000-0000-00000000a003', '10000000-0000-0000-0000-00000000a001',
   '20000000-0000-0000-0000-00000000a001', 'cancelled', 50, 0, 50, '00000000-0000-0000-0000-00000000a001');

-- === Simular owner A ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000a001", "role": "authenticated"}';

-- === C1: Pago asociado a una compra, monto válido ===
select lives_ok(
  $$select public.register_supplier_payment(
      '20000000-0000-0000-0000-00000000a001'::uuid,
      '50000000-0000-0000-0000-00000000a001'::uuid,
      40.00::numeric,
      'transfer',
      now(),
      'Abono 1'
  )$$,
  'C1: admin puede registrar pago parcial válido a una compra');

select is(
  (select sum(amount) from public.supplier_payments where purchase_id = '50000000-0000-0000-0000-00000000a001'),
  40.00::numeric, 'C1: se guardó el abono de 40');

-- === C2: Pago que excede saldo ===
select throws_ok(
  $$select public.register_supplier_payment(
      '20000000-0000-0000-0000-00000000a001'::uuid,
      '50000000-0000-0000-0000-00000000a001'::uuid,
      61.00::numeric,
      'transfer',
      now(),
      'Abono excedente'
  )$$,
  'P0001', 'payment_exceeds_balance', 'C2: rechaza si el abono excede el saldo pendiente (61 > 60 restantes)');

-- === Completar pago ===
select lives_ok(
  $$select public.register_supplier_payment(
      '20000000-0000-0000-0000-00000000a001'::uuid,
      '50000000-0000-0000-0000-00000000a001'::uuid,
      60.00::numeric,
      'transfer',
      now(),
      'Abono final'
  )$$,
  'C1: admin puede saldar la cuenta (60 exactos)');

-- === C3: Pago sin asociar (abono general) ===
select lives_ok(
  $$select public.register_supplier_payment(
      '20000000-0000-0000-0000-00000000a001'::uuid,
      null,
      100.00::numeric,
      'cash',
      now(),
      'Abono general'
  )$$,
  'C3: admin puede registrar abono sin compra (anticipo)');

-- === Rechazo por monto <= 0 ===
select throws_ok(
  $$select public.register_supplier_payment(
      '20000000-0000-0000-0000-00000000a001'::uuid,
      null,
      0::numeric,
      'cash',
      now(),
      null
  )$$,
  'P0001', 'payment_amount_invalid', 'Rechaza monto 0 o negativo');

-- === C4: Compra no pertenece al proveedor indicado ===
select throws_ok(
  $$select public.register_supplier_payment(
      '20000000-0000-0000-0000-00000000a002'::uuid,
      '50000000-0000-0000-0000-00000000a001'::uuid,
      10::numeric,
      'cash',
      now(),
      null
  )$$,
  'P0001', 'purchase_supplier_mismatch', 'C4: rechaza si se intenta pagar una compra con el proveedor incorrecto');

-- === C7: Compra en estado draft no es pagable ===
select throws_ok(
  $$select public.register_supplier_payment(
      '20000000-0000-0000-0000-00000000a001'::uuid,
      '50000000-0000-0000-0000-00000000a002'::uuid,
      10::numeric,
      'cash',
      now(),
      null
  )$$,
  'P0001', 'purchase_not_payable', 'C7: rechaza pago a una compra draft');

-- === C7: Compra cancelada no es pagable ===
select throws_ok(
  $$select public.register_supplier_payment(
      '20000000-0000-0000-0000-00000000a001'::uuid,
      '50000000-0000-0000-0000-00000000a003'::uuid,
      10::numeric,
      'cash',
      now(),
      null
  )$$,
  'P0001', 'purchase_not_payable', 'C7: rechaza pago a una compra cancelled');

-- === Simular member A ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000a002", "role": "authenticated"}';

-- === C5: Member no puede registrar pago ===
select throws_ok(
  $$select public.register_supplier_payment(
      '20000000-0000-0000-0000-00000000a001'::uuid,
      null,
      10::numeric,
      'cash',
      now(),
      null
  )$$,
  'P0001', 'permission_denied', 'C5: member no puede registrar pagos');

-- === Simular owner B ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000b001", "role": "authenticated"}';

-- === C6: Proveedor ajeno ===
select throws_ok(
  $$select public.register_supplier_payment(
      '20000000-0000-0000-0000-00000000a001'::uuid,
      null,
      10::numeric,
      'cash',
      now(),
      null
  )$$,
  'P0001', 'supplier_not_found', 'C6: owner B no puede pagar a proveedor del tenant A');

-- === RLS y escritura directa bloqueada ===
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-00000000a001", "role": "authenticated"}';

select is(
  (select count(*)::int from public.supplier_payments),
  3, 'Aislamiento: Owner A ve solo sus pagos (son 3)');

select throws_ok(
  $$insert into public.supplier_payments (tenant_id, supplier_id, amount, method)
    values ('10000000-0000-0000-0000-00000000a001', '20000000-0000-0000-0000-00000000a001', 10, 'cash')$$,
  '42501', null, 'Aislamiento: Ningún rol puede insertar directamente en la tabla (RLS lo prohíbe)');

select * from finish();
rollback;
