begin;
select plan(12);

-- Fixture
set local role postgres;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', 'test@miel.com', '{"name": "Owner"}');

insert into public.tenants (id, name) values 
('00000000-0000-0000-0000-00000000000a', 'Tenant A'),
('00000000-0000-0000-0000-00000000000b', 'Tenant B');

insert into public.memberships (tenant_id, user_id, role, created_by) values 
('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'owner', '00000000-0000-0000-0000-000000000000');

insert into public.sales (id, tenant_id, status, created_by) values
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'confirmed', '00000000-0000-0000-0000-000000000000'),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'confirmed', '00000000-0000-0000-0000-000000000000'),
('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'draft', '00000000-0000-0000-0000-000000000000'),
('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000b', 'confirmed', '00000000-0000-0000-0000-000000000000');

-- Authenticate as owner of Tenant A
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000000", "email": "test@test.com"}';

-- Test 1: mark_sale_shipped fails if not confirmed
select throws_ok(
  $$select mark_sale_shipped('10000000-0000-0000-0000-000000000003'::uuid, 'Calle 1'::text)$$,
  'P0001',
  'sale_not_confirmed_or_not_found',
  'mark_sale_shipped rechaza ventas en draft'
);

-- Test 2: mark_sale_shipped fails if empty address
select throws_ok(
  $$select mark_sale_shipped('10000000-0000-0000-0000-000000000001'::uuid, ' '::text)$$,
  'P0001',
  'shipping_address_required',
  'mark_sale_shipped exige una direccion no vacia'
);

-- Test 3: mark_sale_shipped success
select lives_ok(
  $$select mark_sale_shipped('10000000-0000-0000-0000-000000000001'::uuid, 'Calle 1'::text)$$,
  'mark_sale_shipped marca la venta como shipped'
);

select results_eq(
  $$select status, shipping_address from public.sales where id = '10000000-0000-0000-0000-000000000001'$$,
  $$values ('shipped'::text, 'Calle 1'::text)$$,
  'La venta despachada guarda la direccion y cambia su estado'
);

select is(
  (select shipped_at is not null from public.sales where id = '10000000-0000-0000-0000-000000000001'),
  true,
  'La venta despachada asigna shipped_at'
);

-- Test 4: mark_sale_delivered from shipped
select lives_ok(
  $$select mark_sale_delivered('10000000-0000-0000-0000-000000000001'::uuid)$$,
  'mark_sale_delivered pasa la venta de shipped a delivered'
);

select results_eq(
  $$select status from public.sales where id = '10000000-0000-0000-0000-000000000001'$$,
  $$values ('delivered'::text)$$,
  'El estado es delivered'
);

select is(
  (select delivered_at is not null from public.sales where id = '10000000-0000-0000-0000-000000000001'),
  true,
  'La venta entregada asigna delivered_at'
);

-- Test 5: mark_sale_delivered directly from confirmed (mostrador)
select lives_ok(
  $$select mark_sale_delivered('10000000-0000-0000-0000-000000000002'::uuid)$$,
  'mark_sale_delivered acepta saltar de confirmed a delivered (venta mostrador)'
);

select results_eq(
  $$select status from public.sales where id = '10000000-0000-0000-0000-000000000002'$$,
  $$values ('delivered'::text)$$,
  'El estado de mostrador es delivered'
);

-- Test 6: mark_sale_delivered fails if draft
select throws_ok(
  $$select mark_sale_delivered('10000000-0000-0000-0000-000000000003'::uuid)$$,
  'P0001',
  'sale_not_confirmed_or_shipped',
  'mark_sale_delivered rechaza ventas en draft'
);

-- Test 7: tenant isolation
select throws_ok(
  $$select mark_sale_shipped('10000000-0000-0000-0000-000000000004'::uuid, 'Calle 2'::text)$$,
  'P0001',
  'sale_not_confirmed_or_not_found',
  'aislamiento: no puede despachar venta de otro tenant'
);

rollback;
