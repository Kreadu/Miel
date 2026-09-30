-- S18-08 — Todo cobro entra a la caja de quien cobra (efectivo exige caja); anular solo sin
-- cobros; devolución de venta cobrada desde Caja (refund_sale, owner/admin con caja abierta).
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000018801', 'owner-s1808@test.local'),
  ('00000000-0000-0000-0000-000000018802', 'cajero-s1808@test.local'),
  ('00000000-0000-0000-0000-000000018803', 'ajeno-s1808@test.local');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-000000018801', 'Tenant S18-08'),
  ('10000000-0000-0000-0000-000000018802', 'Tenant ajeno S18-08');

insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000018801', '10000000-0000-0000-0000-000000018801', 'owner',
   '00000000-0000-0000-0000-000000018801'),
  ('00000000-0000-0000-0000-000000018802', '10000000-0000-0000-0000-000000018801', 'member',
   '00000000-0000-0000-0000-000000018801'),
  ('00000000-0000-0000-0000-000000018803', '10000000-0000-0000-0000-000000018802', 'owner',
   '00000000-0000-0000-0000-000000018803');

insert into public.warehouses (id, tenant_id, name, created_by) values
  ('30000000-0000-0000-0000-000000018801', '10000000-0000-0000-0000-000000018801', 'Bodega',
   '00000000-0000-0000-0000-000000018801');

-- Producto solo online: su boleta no exige caja, así se prueba la regla del cobro por separado.
insert into public.products (id, tenant_id, sku, name, cost, price, tax_rate, sales_channel, created_by) values
  ('40000000-0000-0000-0000-000000018801', '10000000-0000-0000-0000-000000018801', 'S1808',
   'Online', 10, 100, 0, 'online', '00000000-0000-0000-0000-000000018801');

insert into public.stock_movements (tenant_id, product_id, warehouse_id, kind, qty, unit_cost, created_by) values
  ('10000000-0000-0000-0000-000000018801', '40000000-0000-0000-0000-000000018801',
   '30000000-0000-0000-0000-000000018801', 'in', 10, 10, '00000000-0000-0000-0000-000000018801');

insert into public.customers (id, tenant_id, name, created_by) values
  ('50000000-0000-0000-0000-000000018801', '10000000-0000-0000-0000-000000018801', 'Cliente',
   '00000000-0000-0000-0000-000000018801');

create temp table s1808 (label text, sale_id uuid) on commit drop;
grant all on s1808 to authenticated;

-- Cajero: dos ventas confirmadas de 2 unidades (total 200 c/u)
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000018802", "role": "authenticated"}';

insert into s1808
select l, public.create_sale('10000000-0000-0000-0000-000000018801',
  '[{"product_id": "40000000-0000-0000-0000-000000018801", "qty": 2}]'::jsonb,
  '50000000-0000-0000-0000-000000018801', l)
from unnest(array['cobrada', 'sin_cobro']) l;
select public.confirm_sale(sale_id, '30000000-0000-0000-0000-000000018801') from s1808;

-- === Cobro en efectivo sin caja ===
select throws_ok(
  $$select public.register_customer_payment('50000000-0000-0000-0000-000000018801',
    (select sale_id from s1808 where label = 'cobrada'), 200, 'cash', now(), null)$$,
  'P0001', 'cash_session_required', 'efectivo sin caja abierta: no cobra');
select is((select count(*)::int from public.customer_payments
           where sale_id = (select sale_id from s1808 where label = 'cobrada')), 0, 'nada guardado');

-- === Con caja: el cobro queda en la caja de quien cobra ===
select public.open_cash_session(50, '10000000-0000-0000-0000-000000018801');
select lives_ok(
  $$select public.register_customer_payment('50000000-0000-0000-0000-000000018801',
    (select sale_id from s1808 where label = 'cobrada'), 150, 'cash', now(), null)$$,
  'efectivo con caja abierta');
select lives_ok(
  $$select public.register_customer_payment('50000000-0000-0000-0000-000000018801',
    (select sale_id from s1808 where label = 'cobrada'), 50, 'card', now(), null)$$,
  'tarjeta con caja abierta');
select is(
  (select count(*)::int from public.customer_payments
   where sale_id = (select sale_id from s1808 where label = 'cobrada')
     and cash_session_id = (select id from public.cash_sessions
                            where opened_by = '00000000-0000-0000-0000-000000018802' and status = 'open')),
  2, 'los dos cobros quedan ligados a la caja del cajero');
select results_eq(
  $$select cash_total, card_total from public.cash_session_summary
    where opened_by = '00000000-0000-0000-0000-000000018802'$$,
  $$values (150::numeric, 50::numeric)$$,
  'la caja suma cada forma de pago');

-- === Anular: solo sin cobros ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000018801", "role": "authenticated"}';
select throws_ok(
  $$select public.cancel_sale((select sale_id from s1808 where label = 'cobrada'))$$,
  'P0001', 'sale_has_payments', 'una venta cobrada no se anula: se devuelve desde Caja');
select lives_ok(
  $$select public.cancel_sale((select sale_id from s1808 where label = 'sin_cobro'))$$,
  'una venta sin cobros sí se anula');

-- === Devolución: reglas ===
select throws_ok(
  $$select public.refund_sale('10000000-0000-0000-0000-000000018801',
    (select receipt_number from public.sales where id = (select sale_id from s1808 where label = 'cobrada')),
    'Cliente devolvió')$$,
  'P0001', 'cash_session_required', 'el dueño necesita su caja abierta para devolver');

select public.open_cash_session(0, '10000000-0000-0000-0000-000000018801');

select throws_ok(
  $$select public.refund_sale('10000000-0000-0000-0000-000000018801',
    (select receipt_number from public.sales where id = (select sale_id from s1808 where label = 'cobrada')),
    '   ')$$,
  'P0001', 'refund_reason_required', 'exige motivo');
select throws_ok(
  $$select public.refund_sale('10000000-0000-0000-0000-000000018801', 999999, 'x')$$,
  'P0001', 'sale_not_found', 'boleta inexistente');

set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000018802", "role": "authenticated"}';
select throws_ok(
  $$select public.refund_sale('10000000-0000-0000-0000-000000018801',
    (select receipt_number from public.sales where id = (select sale_id from s1808 where label = 'cobrada')),
    'Cliente devolvió')$$,
  'P0001', 'permission_denied', 'un operativo no hace devoluciones');

set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000018803", "role": "authenticated"}';
select throws_ok(
  $$select public.refund_sale('10000000-0000-0000-0000-000000018801',
    (select receipt_number from public.sales where id = (select sale_id from s1808 where label = 'cobrada')),
    'x')$$,
  'P0001', 'permission_denied', 'otra empresa no devuelve ventas de esta');

-- === Devolución: caso feliz (dueño con su caja) ===
set local "request.jwt.claims" to
  '{"sub": "00000000-0000-0000-0000-000000018801", "role": "authenticated"}';
select lives_ok(
  $$select public.refund_sale('10000000-0000-0000-0000-000000018801',
    (select receipt_number from public.sales where id = (select sale_id from s1808 where label = 'cobrada')),
    'Producto defectuoso')$$,
  'el dueño devuelve la venta cobrada');
select results_eq(
  $$select status, refund_reason, refunded_by from public.sales
    where id = (select sale_id from s1808 where label = 'cobrada')$$,
  $$values ('cancelled'::text, 'Producto defectuoso'::text, '00000000-0000-0000-0000-000000018801'::uuid)$$,
  'la venta queda anulada con motivo y quién');
select is((select sum(amount) from public.customer_payments
           where sale_id = (select sale_id from s1808 where label = 'cobrada')),
  0::numeric, 'el dinero devuelto cancela lo cobrado');
select is(
  (select sum(amount) from public.customer_payments
   where sale_id = (select sale_id from s1808 where label = 'cobrada') and amount < 0
     and cash_session_id = (select id from public.cash_sessions
                            where opened_by = '00000000-0000-0000-0000-000000018801' and status = 'open')),
  -200::numeric, 'la devolución sale de la caja de quien devuelve');
select is(
  (select sum(qty)::int from public.stock_movements where product_id = '40000000-0000-0000-0000-000000018801'),
  10, 'el stock vuelve completo (se anularon ambas ventas)');
select throws_ok(
  $$select public.refund_sale('10000000-0000-0000-0000-000000018801',
    (select receipt_number from public.sales where id = (select sale_id from s1808 where label = 'cobrada')),
    'otra vez')$$,
  'P0001', 'sale_already_cancelled', 'no se devuelve dos veces');

-- === Nadie edita ni borra cobros ===
select throws_ok(
  $$delete from public.customer_payments where sale_id = (select sale_id from s1808 where label = 'cobrada')$$,
  '42501', null, 'ni el dueño borra cobros');

select * from finish();
rollback;
