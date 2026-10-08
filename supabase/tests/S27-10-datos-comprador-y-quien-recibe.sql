-- S27-10 — Pedido de la tienda con documento del comprador, celular con código de país y datos de
-- quien recibe o recoge (si no es el comprador). Ver specs/S27-10-datos-comprador-y-quien-recibe.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000002710a', 'o-s2710@test.local');
insert into public.tenants (id, name, store_enabled, store_slug, store_pay_in_store) values
  ('10000000-0000-0000-0000-00000002710a', 'Dulce', true, 'dulce-2710', true);
insert into public.products (id, tenant_id, sku, name, price, inventory, sales_channel, created_by) values
  ('30000000-0000-0000-0000-00000002710a', '10000000-0000-0000-0000-00000002710a', 'A', 'Miel', 1000, 'productos', 'both', '00000000-0000-0000-0000-00000002710a');
insert into public.warehouses (id, tenant_id, name, created_by) values
  ('40000000-0000-0000-0000-00000002710a', '10000000-0000-0000-0000-00000002710a', 'W', '00000000-0000-0000-0000-00000002710a');
insert into public.stock_movements (tenant_id, product_id, warehouse_id, kind, qty, unit_cost, created_by) values
  ('10000000-0000-0000-0000-00000002710a', '30000000-0000-0000-0000-00000002710a', '40000000-0000-0000-0000-00000002710a', 'in', 50, 1, '00000000-0000-0000-0000-00000002710a');
-- Cliente que ya existía, guardado sin código de país.
insert into public.customers (id, tenant_id, name, phone) values
  ('60000000-0000-0000-0000-00000002710a', '10000000-0000-0000-0000-00000002710a', 'Eva Vieja', '3200000001');

set local role anon;
set local "request.jwt.claims" to '{"role": "anon"}';
create temp table t on commit drop as
  select * from public.place_store_order('dulce-2710',
    '{"name": "Ana María Pérez Gómez", "phone": "+57 3105550001", "doc_type": "cc", "doc_number": "1020304050",
      "receiver": {"name": "Luis Torres", "doc_type": "cc", "doc_number": "998877", "phone": "+1 3055550000"}}'::jsonb,
    '[{"product_id": "30000000-0000-0000-0000-00000002710a", "qty": 1}]'::jsonb, 'pickup', 'in_store', null, null);
grant select on t to anon;
reset role;

select results_eq(
  $$select c.name, c.phone, c.doc_type, c.doc_number from public.sales s join public.customers c on c.id = s.customer_id
    where s.public_token = (select token from t)$$,
  $$values ('Ana María Pérez Gómez'::text, '+57 3105550001'::text, 'cc'::text, '1020304050'::text)$$,
  'C1: el comprador queda con su documento y el celular con código de país');
select results_eq(
  $$select receiver_name, receiver_doc, receiver_phone from public.sales where public_token = (select token from t)$$,
  $$values ('Luis Torres'::text, 'CC 998877'::text, '+1 3055550000'::text)$$,
  'C2: el pedido guarda quién recoge');

-- C3: sin receptor (lo recibe quien compra) y cliente que ya existía (+57 se reconoce)
set local role anon;
create temp table t2 on commit drop as
  select * from public.place_store_order('dulce-2710',
    '{"name": "Eva Nueva", "phone": "+57 320 000 0001", "doc_type": "ce", "doc_number": "A12345"}'::jsonb,
    '[{"product_id": "30000000-0000-0000-0000-00000002710a", "qty": 1}]'::jsonb, 'pickup', 'in_store', null, null);
grant select on t2 to anon;
reset role;
select is((select customer_id from public.sales where public_token = (select token from t2)),
  '60000000-0000-0000-0000-00000002710a'::uuid, 'C3: el cliente que ya existía se reconoce con +57');
select ok((select receiver_name is null and receiver_phone is null from public.sales where public_token = (select token from t2)),
  'C3: lo recibe quien compra: sin datos de receptor');
select is((select doc_number from public.customers where id = '60000000-0000-0000-0000-00000002710a'),
  'A12345', 'C3: completa el documento que le faltaba');

set local role anon;
select throws_like(
  $$select * from public.place_store_order('dulce-2710', '{"name": "Eva", "phone": "+57 3105550002", "doc_type": "pa", "doc_number": "123456"}'::jsonb,
      '[{"product_id": "30000000-0000-0000-0000-00000002710a", "qty": 1}]'::jsonb, 'pickup', 'in_store', null, null)$$,
  '%customer_invalid%', 'C4: tipo de documento inválido');
select throws_like(
  $$select * from public.place_store_order('dulce-2710', '{"name": "Eva", "phone": "+57 3105550002", "doc_type": "cc", "doc_number": "1"}'::jsonb,
      '[{"product_id": "30000000-0000-0000-0000-00000002710a", "qty": 1}]'::jsonb, 'pickup', 'in_store', null, null)$$,
  '%customer_invalid%', 'C4: documento muy corto');
select throws_like(
  $$select * from public.place_store_order('dulce-2710', '{"name": "Eva", "phone": "+57 3105550002", "doc_type": "cc", "doc_number": "123456",
      "receiver": {"name": "L", "doc_type": "cc", "doc_number": "1234", "phone": "+57 3000000000"}}'::jsonb,
      '[{"product_id": "30000000-0000-0000-0000-00000002710a", "qty": 1}]'::jsonb, 'pickup', 'in_store', null, null)$$,
  '%receiver_invalid%', 'C4: receptor sin nombre válido');
select throws_like(
  $$select * from public.place_store_order('dulce-2710', '{"name": "Eva", "phone": "+57 3105550002", "doc_type": "cc", "doc_number": "123456",
      "receiver": {"name": "Luis", "doc_type": "cc", "doc_number": "1234", "phone": "12"}}'::jsonb,
      '[{"product_id": "30000000-0000-0000-0000-00000002710a", "qty": 1}]'::jsonb, 'pickup', 'in_store', null, null)$$,
  '%receiver_invalid%', 'C4: receptor con celular inválido');

select * from finish();
rollback;
