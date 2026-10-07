-- S27-02 — Pedido desde la tienda en línea: place_store_order (anon, atómica, precios de la BD,
-- límites anti-abuso). Ver specs/S27-02-carrito-y-pedido.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000027201', 'owner-s2702@test.local');
insert into public.tenants (id, name, store_enabled, store_slug) values
  ('10000000-0000-0000-0000-000000027201', 'Dulce', true, 'dulce'),
  ('10000000-0000-0000-0000-000000027202', 'Apagada', false, 'apagada');
insert into public.memberships (user_id, tenant_id, role, created_by) values
  ('00000000-0000-0000-0000-000000027201', '10000000-0000-0000-0000-000000027201', 'owner',
   '00000000-0000-0000-0000-000000027201');

-- P1 con stock (10% desc, IVA 19) · P2 con stock sin IVA · P3 agotado · P4 solo tienda física
-- P5 de la tienda apagada
insert into public.products (id, tenant_id, sku, name, price, tax_rate, discount_percent, inventory,
                             sales_channel, created_by) values
  ('30000000-0000-0000-0000-000000027201', '10000000-0000-0000-0000-000000027201', 'P1', 'Miel', 10000, 19, 10, 'productos', 'both', '00000000-0000-0000-0000-000000027201'),
  ('30000000-0000-0000-0000-000000027202', '10000000-0000-0000-0000-000000027201', 'P2', 'Polen', 5000, 0, 0, 'productos', 'online', '00000000-0000-0000-0000-000000027201'),
  ('30000000-0000-0000-0000-000000027203', '10000000-0000-0000-0000-000000027201', 'P3', 'Agotado', 1000, 0, 0, 'productos', 'both', '00000000-0000-0000-0000-000000027201'),
  ('30000000-0000-0000-0000-000000027204', '10000000-0000-0000-0000-000000027201', 'P4', 'Local', 1000, 0, 0, 'productos', 'in_store', '00000000-0000-0000-0000-000000027201'),
  ('30000000-0000-0000-0000-000000027205', '10000000-0000-0000-0000-000000027202', 'P5', 'Ajeno', 1000, 0, 0, 'productos', 'both', '00000000-0000-0000-0000-000000027201');
insert into public.warehouses (id, tenant_id, name, created_by) values
  ('40000000-0000-0000-0000-000000027201', '10000000-0000-0000-0000-000000027201', 'B1', '00000000-0000-0000-0000-000000027201');
insert into public.stock_movements (tenant_id, product_id, warehouse_id, kind, qty, unit_cost, created_by) values
  ('10000000-0000-0000-0000-000000027201', '30000000-0000-0000-0000-000000027201', '40000000-0000-0000-0000-000000027201', 'in', 5, 1, '00000000-0000-0000-0000-000000027201'),
  ('10000000-0000-0000-0000-000000027201', '30000000-0000-0000-0000-000000027202', '40000000-0000-0000-0000-000000027201', 'in', 5, 1, '00000000-0000-0000-0000-000000027201'),
  ('10000000-0000-0000-0000-000000027201', '30000000-0000-0000-0000-000000027204', '40000000-0000-0000-0000-000000027201', 'in', 5, 1, '00000000-0000-0000-0000-000000027201');
-- Cliente que ya existía (teléfono con formato distinto).
insert into public.customers (id, tenant_id, name, phone, created_by) values
  ('80000000-0000-0000-0000-000000027201', '10000000-0000-0000-0000-000000027201', 'Ana Existente', '+57 300 111 2222',
   '00000000-0000-0000-0000-000000027201');

set local role anon;
set local "request.jwt.claims" to '{"role": "anon"}';

-- === C1: pedido feliz, cliente nuevo; precios de la BD (se ignora unit_price del navegador) ===
select lives_ok(
  $$select * from public.place_store_order('dulce',
      '{"name": "Luis Nuevo", "phone": "310 555 0001", "email": "luis@x.co"}'::jsonb,
      '[{"product_id": "30000000-0000-0000-0000-000000027201", "qty": 2, "unit_price": 1},
        {"product_id": "30000000-0000-0000-0000-000000027202", "qty": 1}]'::jsonb,
      'delivery', 'nequi', 'Calle 1 # 2-3', 'Timbre azul')$$,
  'C1: anon hace un pedido');

reset role;
select is((select count(*)::int from public.sales where source = 'store'), 1, 'C1: queda una venta de la tienda');
select ok((select status = 'draft' and created_by is null and store_payment = 'nequi'
             and delivery_method = 'agreed' and shipping_cost = 0 and shipping_address = 'Calle 1 # 2-3'
             and note = 'Timbre azul'
           from public.sales where source = 'store'),
  'C1: borrador, sin creador, pago preferido, envío a confirmar, dirección y nota');
-- P1: 2 × 10000 − 2000 desc = 18000 + 19% = 3420 → 21420 ; P2: 5000 → total 26420
select is((select total from public.sales where source = 'store'), 26420.00::numeric, 'C1: total con precios y descuento de la BD');
select is((select unit_price from public.sale_items si join public.sales s on s.id = si.sale_id
           where s.source = 'store' and si.product_id = '30000000-0000-0000-0000-000000027201'),
  10000.00::numeric, 'C1: el precio del navegador se ignora');
select is((select discount from public.sale_items si join public.sales s on s.id = si.sale_id
           where s.source = 'store' and si.product_id = '30000000-0000-0000-0000-000000027201'),
  2000.00::numeric, 'C1: descuento = qty·precio·%');
select ok((select c.name = 'Luis Nuevo' and c.phone = '3105550001' and c.created_by is null
           from public.customers c join public.sales s on s.customer_id = c.id where s.source = 'store'),
  'C1: cliente nuevo con teléfono normalizado');

-- === C1: cliente existente por teléfono (no se cambian sus datos) ===
set local role anon;
select lives_ok(
  $$select * from public.place_store_order('dulce', '{"name": "Otro Nombre", "phone": "3001112222"}'::jsonb,
      '[{"product_id": "30000000-0000-0000-0000-000000027202", "qty": 1}]'::jsonb, 'pickup', 'in_store', null, null)$$,
  'C1: pedido de un cliente que ya existía');
reset role;
select is((select count(*)::int from public.customers where tenant_id = '10000000-0000-0000-0000-000000027201'), 2,
  'C1: no duplica el cliente');
select is((select name from public.customers where id = '80000000-0000-0000-0000-000000027201'), 'Ana Existente',
  'C1: no cambia sus datos');
select is((select count(*)::int from public.sales where customer_id = '80000000-0000-0000-0000-000000027201'), 1,
  'C1: el pedido queda a su nombre');
select is((select delivery_method from public.sales where customer_id = '80000000-0000-0000-0000-000000027201'), 'pickup',
  'C1: recoger en tienda');

-- === C2/C3: rechazos (y nada a medias) ===
set local role anon;
select throws_like(
  $$select * from public.place_store_order('dulce', '{"name": "Eva", "phone": "3200000001"}'::jsonb,
      '[{"product_id": "30000000-0000-0000-0000-000000027202", "qty": 1},
        {"product_id": "30000000-0000-0000-0000-000000027203", "qty": 1}]'::jsonb, 'pickup', 'nequi', null, null)$$,
  'product_unavailable:Agotado', 'C2: agotado → dice cuál');
select throws_like(
  $$select * from public.place_store_order('dulce', '{"name": "Eva", "phone": "3200000001"}'::jsonb,
      '[{"product_id": "30000000-0000-0000-0000-000000027204", "qty": 1}]'::jsonb, 'pickup', 'nequi', null, null)$$,
  'product_unavailable:Local', 'C2: solo tienda física no se vende en línea');
select throws_like(
  $$select * from public.place_store_order('dulce', '{"name": "Eva", "phone": "3200000001"}'::jsonb,
      '[{"product_id": "30000000-0000-0000-0000-000000027205", "qty": 1}]'::jsonb, 'pickup', 'nequi', null, null)$$,
  'product_unavailable%', 'C3: producto de otra empresa');
select throws_like(
  $$select * from public.place_store_order('dulce', '{"name": "Eva", "phone": "3200000001"}'::jsonb,
      '[{"product_id": "30000000-0000-0000-0000-000000027201", "qty": 100}]'::jsonb, 'pickup', 'nequi', null, null)$$,
  'item_qty_invalid', 'C3: más de 99 unidades');
select throws_like(
  $$select * from public.place_store_order('dulce', '{"name": "Eva", "phone": "3200000001"}'::jsonb,
      '[{"product_id": "30000000-0000-0000-0000-000000027201", "qty": 1.5}]'::jsonb, 'pickup', 'nequi', null, null)$$,
  'item_qty_invalid', 'C3: cantidad no entera');
select throws_like(
  $$select * from public.place_store_order('dulce', '{"name": "Eva", "phone": "3200000001"}'::jsonb,
      '[{"product_id": "30000000-0000-0000-0000-000000027201", "qty": 1},
        {"product_id": "30000000-0000-0000-0000-000000027201", "qty": 1}]'::jsonb, 'pickup', 'nequi', null, null)$$,
  'items_invalid', 'C3: producto repetido');
select throws_like(
  $$select * from public.place_store_order('apagada', '{"name": "Eva", "phone": "3200000001"}'::jsonb,
      '[{"product_id": "30000000-0000-0000-0000-000000027205", "qty": 1}]'::jsonb, 'pickup', 'nequi', null, null)$$,
  'store_unavailable', 'C3: tienda apagada');
select throws_like(
  $$select * from public.place_store_order('dulce', '{"name": "Eva", "phone": "3200000001"}'::jsonb,
      '[{"product_id": "30000000-0000-0000-0000-000000027201", "qty": 1}]'::jsonb, 'delivery', 'nequi', '  ', null)$$,
  'address_required', 'C3: envío sin dirección');
select throws_like(
  $$select * from public.place_store_order('dulce', '{"name": "Eva", "phone": "3200000001"}'::jsonb,
      '[{"product_id": "30000000-0000-0000-0000-000000027201", "qty": 1}]'::jsonb, 'delivery', 'in_store', 'Calle 1', null)$$,
  'payment_invalid', 'C3: pagar al recoger exige recoger');
select throws_like(
  $$select * from public.place_store_order('dulce', '{"name": "E", "phone": "12"}'::jsonb,
      '[{"product_id": "30000000-0000-0000-0000-000000027201", "qty": 1}]'::jsonb, 'pickup', 'nequi', null, null)$$,
  'customer_invalid', 'C3: nombre o celular inválidos');
reset role;
select is((select count(*)::int from public.sales where source = 'store'), 2, 'C2/C3: los rechazos no dejan pedidos');
select is((select count(*)::int from public.customers where phone = '3200000001'), 0, 'C2/C3: ni clientes a medias');

-- === C4: límite por teléfono (3 cada 10 minutos) ===
set local role anon;
select lives_ok(
  $$select public.place_store_order('dulce', '{"name": "Luis Nuevo", "phone": "3105550001"}'::jsonb,
      '[{"product_id": "30000000-0000-0000-0000-000000027202", "qty": 1}]'::jsonb, 'pickup', 'nequi', null, null);
    select public.place_store_order('dulce', '{"name": "Luis Nuevo", "phone": "3105550001"}'::jsonb,
      '[{"product_id": "30000000-0000-0000-0000-000000027202", "qty": 1}]'::jsonb, 'pickup', 'nequi', null, null)$$,
  'C4: segundo y tercer pedido del mismo teléfono');
select throws_like(
  $$select * from public.place_store_order('dulce', '{"name": "Luis Nuevo", "phone": "+57 310 555 0001"}'::jsonb,
      '[{"product_id": "30000000-0000-0000-0000-000000027202", "qty": 1}]'::jsonb, 'pickup', 'nequi', null, null)$$,
  'too_many_orders', 'C4: el cuarto en 10 minutos se rechaza');

select * from finish();
rollback;
