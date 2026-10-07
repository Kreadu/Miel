-- S27-03 — Pago manual de la tienda: formas de pago de la empresa (store_info.payments), métodos
-- apagados rechazados por place_store_order, token secreto y attach_payment_proof.
-- Las políticas de Storage no se prueban aquí (las verifica el humano subiendo un comprobante).
-- Ver specs/S27-03-pago-manual.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000027301', 'owner-s2703@test.local');
insert into public.tenants (id, name, store_enabled, store_slug, store_nequi, store_bank_info,
                            store_payment_qr_url, store_cash_on_delivery, store_pay_in_store) values
  ('10000000-0000-0000-0000-000000027301', 'Dulce', true, 'dulce', '300 123 4567',
   'Bancolombia ahorros 123-456 a nombre de Dulce SAS', 'https://x.co/qr.png', false, true),
  ('10000000-0000-0000-0000-000000027302', 'Sin config', true, 'sin-config', null, null, null, true, true);
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000027301', '10000000-0000-0000-0000-000000027301', 'owner', '00000000-0000-0000-0000-000000027301');
insert into public.products (id, tenant_id, sku, name, price, tax_rate, created_by) values
  ('30000000-0000-0000-0000-000000027301', '10000000-0000-0000-0000-000000027301', 'P1', 'Miel', 10000, 0, '00000000-0000-0000-0000-000000027301'),
  ('30000000-0000-0000-0000-000000027302', '10000000-0000-0000-0000-000000027302', 'P2', 'Polen', 10000, 0, '00000000-0000-0000-0000-000000027301');
insert into public.warehouses (id, tenant_id, name, created_by) values
  ('40000000-0000-0000-0000-000000027301', '10000000-0000-0000-0000-000000027301', 'B', '00000000-0000-0000-0000-000000027301'),
  ('40000000-0000-0000-0000-000000027302', '10000000-0000-0000-0000-000000027302', 'B', '00000000-0000-0000-0000-000000027301');
insert into public.stock_movements (tenant_id, product_id, warehouse_id, kind, qty, unit_cost, created_by) values
  ('10000000-0000-0000-0000-000000027301', '30000000-0000-0000-0000-000000027301', '40000000-0000-0000-0000-000000027301', 'in', 9, 1, '00000000-0000-0000-0000-000000027301'),
  ('10000000-0000-0000-0000-000000027302', '30000000-0000-0000-0000-000000027302', '40000000-0000-0000-0000-000000027302', 'in', 9, 1, '00000000-0000-0000-0000-000000027301');

set local role anon;
set local "request.jwt.claims" to '{"role": "anon"}';

-- === C1/C2: lo que la tienda ofrece ===
select is((select payments->>'nequi' from public.store_info('dulce')), '300 123 4567', 'C2: Nequi configurado');
select is((select payments->>'daviplata' from public.store_info('dulce')), null, 'C1: Daviplata sin datos no se ofrece');
select is((select payments->>'transfer' from public.store_info('dulce')), 'Bancolombia ahorros 123-456 a nombre de Dulce SAS', 'C2: cuenta bancaria');
select is((select payments->>'qr' from public.store_info('dulce')), 'https://x.co/qr.png', 'C2: QR');
select is((select (payments->>'cash_on_delivery')::boolean from public.store_info('dulce')), false, 'C1: contra entrega apagada');
select is((select (payments->>'in_store')::boolean from public.store_info('dulce')), true, 'C1: pagar al recoger encendida');

select throws_like(
  $$select * from public.place_store_order('dulce', '{"name": "Eva", "phone": "3200000001"}'::jsonb,
      '[{"product_id": "30000000-0000-0000-0000-000000027301", "qty": 1}]'::jsonb, 'pickup', 'daviplata', null, null)$$,
  'payment_invalid', 'C1: método sin datos se rechaza');
select throws_like(
  $$select * from public.place_store_order('dulce', '{"name": "Eva", "phone": "3200000001"}'::jsonb,
      '[{"product_id": "30000000-0000-0000-0000-000000027301", "qty": 1}]'::jsonb, 'delivery', 'cash_on_delivery', 'Calle 1', null)$$,
  'payment_invalid', 'C1: método apagado se rechaza');
select throws_like(
  $$select * from public.place_store_order('sin-config', '{"name": "Eva", "phone": "3200000001"}'::jsonb,
      '[{"product_id": "30000000-0000-0000-0000-000000027302", "qty": 1}]'::jsonb, 'pickup', 'transfer', null, null)$$,
  'payment_invalid', 'C1: sin cuenta bancaria no hay transferencia');
select lives_ok(
  $$select * from public.place_store_order('sin-config', '{"name": "Eva", "phone": "3200000001"}'::jsonb,
      '[{"product_id": "30000000-0000-0000-0000-000000027302", "qty": 1}]'::jsonb, 'delivery', 'cash_on_delivery', 'Calle 1', null)$$,
  'C1: sin configurar, contra entrega sigue disponible');

-- === C3: pedido con Nequi devuelve el token secreto ===
create temp table t_order on commit drop as
  select * from public.place_store_order('dulce', '{"name": "Luis", "phone": "3105550001"}'::jsonb,
    '[{"product_id": "30000000-0000-0000-0000-000000027301", "qty": 2}]'::jsonb, 'pickup', 'nequi', null, null);
select isnt((select token from t_order), null, 'C3: el pedido devuelve su token');

select ok(public.store_order_token_ok((select token::text from t_order)), 'C3: el token es válido para subir');
select ok(not public.store_order_token_ok(gen_random_uuid()::text), 'C4: un token inventado no');
select ok(not public.store_order_token_ok('no-es-uuid'), 'C4: basura no (sin error)');

select lives_ok(
  format($$select public.attach_payment_proof('%s'::uuid, '%s/comprobante.jpg')$$,
         (select token from t_order), (select token from t_order)),
  'C3: adjunta el comprobante');
reset role;
select ok((select payment_proof_path like '%/comprobante.jpg' and payment_proof_at is not null and payment_proof_count = 1
           from public.sales where public_token = (select token from t_order)),
  'C3: queda la ruta, la fecha y el contador');

set local role anon;
select throws_like(
  format($$select public.attach_payment_proof('%s'::uuid, 'otra-carpeta/x.jpg')$$, (select token from t_order)),
  'proof_invalid', 'C4: la ruta tiene que estar en la carpeta de su token');
select throws_like(
  $$select public.attach_payment_proof(gen_random_uuid(), 'x/y.jpg')$$,
  'proof_invalid', 'C4: token inventado');

-- Quinta subida permitida, sexta no.
reset role;
update public.sales set payment_proof_count = 5 where public_token = (select token from t_order);
set local role anon;
select throws_like(
  format($$select public.attach_payment_proof('%s'::uuid, '%s/otra.jpg')$$, (select token from t_order), (select token from t_order)),
  'proof_invalid', 'C4: la sexta subida se rechaza');
select ok(not public.store_order_token_ok((select token::text from t_order)), 'C4: y Storage tampoco la deja subir');

select * from finish();
rollback;
