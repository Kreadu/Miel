-- S27-04 — Seguimiento del pedido de la tienda: store_order_status (anon, por llave secreta).
-- Ver specs/S27-04-seguimiento-y-aviso.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000027401', 'owner-s2704@test.local');
insert into public.tenants (id, name, store_enabled, store_slug, store_nequi) values
  ('10000000-0000-0000-0000-000000027401', 'Dulce', true, 'dulce', '3001234567'),
  ('10000000-0000-0000-0000-000000027402', 'Otra', true, 'otra', null);
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000027401', '10000000-0000-0000-0000-000000027401', 'owner', '00000000-0000-0000-0000-000000027401');
insert into public.products (id, tenant_id, sku, name, price, tax_rate, created_by) values
  ('30000000-0000-0000-0000-000000027401', '10000000-0000-0000-0000-000000027401', 'P1', 'Miel', 10000, 0, '00000000-0000-0000-0000-000000027401');
insert into public.warehouses (id, tenant_id, name, created_by) values
  ('40000000-0000-0000-0000-000000027401', '10000000-0000-0000-0000-000000027401', 'B', '00000000-0000-0000-0000-000000027401');
insert into public.stock_movements (tenant_id, product_id, warehouse_id, kind, qty, unit_cost, created_by) values
  ('10000000-0000-0000-0000-000000027401', '30000000-0000-0000-0000-000000027401', '40000000-0000-0000-0000-000000027401', 'in', 9, 1, '00000000-0000-0000-0000-000000027401');

set local role anon;
set local "request.jwt.claims" to '{"role": "anon"}';
create temp table t_order on commit drop as
  select * from public.place_store_order('dulce', '{"name": "Luis Secreto", "phone": "3105550001"}'::jsonb,
    '[{"product_id": "30000000-0000-0000-0000-000000027401", "qty": 2}]'::jsonb, 'delivery', 'nequi', 'Calle Privada 1', null);

-- === C1: recién hecho ===
select is((public.store_order_status('dulce', (select token from t_order)))->>'code', (select order_code from t_order), 'C1: código');
select is((public.store_order_status('dulce', (select token from t_order)))->>'status', 'draft', 'C1: recibido (borrador)');
select is((public.store_order_status('dulce', (select token from t_order)))->>'payment_status', 'pending', 'C1: pago pendiente');
select is(((public.store_order_status('dulce', (select token from t_order)))->>'can_upload')::boolean, true, 'C1: puede subir comprobante');
select is(((public.store_order_status('dulce', (select token from t_order)))->>'total')::numeric, 20000::numeric, 'C1: total');
select is(jsonb_array_length((public.store_order_status('dulce', (select token from t_order)))->'items'), 1, 'C1: ítems');
select is((public.store_order_status('dulce', (select token from t_order)))->'items'->0->>'name', 'Miel', 'C1: nombre del producto');
select is((public.store_order_status('dulce', (select token from t_order)))->'payments'->>'nequi', '3001234567', 'C1: instrucciones de pago de la tienda');
-- H3: sin datos personales del cliente ni ids internos.
select ok(public.store_order_status('dulce', (select token from t_order))::text !~ '(Luis Secreto|3105550001|Calle Privada|customer_id|"id")',
  'C1: no expone nombre, teléfono, dirección ni ids');

-- === C3: llave falsa, otra tienda ===
select is(public.store_order_status('dulce', gen_random_uuid()), null, 'C3: llave inventada');
select is(public.store_order_status('otra', (select token from t_order)), null, 'C3: llave de otra tienda');
select is(public.store_order_status('no-existe', (select token from t_order)), null, 'C3: tienda inexistente');

-- === C2: la empresa confirma y cobra el total ===
reset role;
update public.sales set status = 'confirmed' where public_token = (select token from t_order);
insert into public.customer_payments (tenant_id, customer_id, sale_id, amount, method, created_by)
select tenant_id, customer_id, id, 20000, 'transfer', '00000000-0000-0000-0000-000000027401'
from public.sales where public_token = (select token from t_order);
set local role anon;
select is((public.store_order_status('dulce', (select token from t_order)))->>'status', 'confirmed', 'C2: confirmado');
select is((public.store_order_status('dulce', (select token from t_order)))->>'payment_status', 'paid', 'C2: pagado');
select is(((public.store_order_status('dulce', (select token from t_order)))->>'can_upload')::boolean, false, 'C2: ya no pide comprobante');

-- Comprobante enviado (sin cobrar aún) = "proof_sent".
reset role;
delete from public.customer_payments where sale_id = (select id from public.sales where public_token = (select token from t_order));
update public.sales set payment_proof_at = now(), payment_proof_count = 1 where public_token = (select token from t_order);
set local role anon;
select is((public.store_order_status('dulce', (select token from t_order)))->>'payment_status', 'proof_sent', 'C2: comprobante enviado');

select * from finish();
rollback;
